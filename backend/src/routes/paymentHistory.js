const express = require('express');
const router = express.Router();
const db = require('../db');

// Helper to sanitize mobile
const cleanMob = (m) => (m || '').replace(/\D/g, '').slice(-10);

/**
 * GET /api/payments/history
 * Unified payment history across ICICI UPI, PayU, Wallet transactions, and Deposit Refunds.
 * Returns live records and aggregated KPI metrics.
 */
router.get('/', async (req, res) => {
  try {
    // Only cleanup obvious dummy 1800/1820 mock numbers from old development tests
    db.query(`
      DELETE FROM payu_payments WHERE mobile LIKE '%1800%' OR mobile LIKE '%1820%';
      DELETE FROM icici_payments WHERE mobile LIKE '%1800%' OR mobile LIKE '%1820%';
    `).catch(() => {});

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim().toLowerCase();
    const typeFilter = (req.query.type || 'all').toLowerCase();
    const statusFilter = (req.query.status || 'all').toLowerCase();
    const rawZoneFilter = (req.query.zone || '').trim();
    const fromDate = req.query.from_date;
    const toDate = req.query.to_date;

    // Role-based and Zone-based access control
    const callerRole = (req.headers['x-user-role'] || (req.user && req.user.role) || '').toLowerCase();
    const callerZone = (req.headers['x-user-zone'] || (req.user && req.user.zone) || '').trim();
    const isGlobalAdmin = callerRole.includes('super_admin') || 
                          callerRole.includes('super admin') || 
                          callerRole.includes('platform admin') || 
                          callerRole === 'admin' ||
                          callerRole === 'system';

    let effectiveZoneFilter = rawZoneFilter;
    if (!isGlobalAdmin && callerZone && callerZone.toLowerCase() !== 'all' && callerZone.toLowerCase() !== 'all zones') {
      const callerAssigned = callerZone.split(',').map(z => z.trim()).filter(Boolean);
      if (effectiveZoneFilter && effectiveZoneFilter.toLowerCase() !== 'all' && effectiveZoneFilter.toLowerCase() !== 'all zones') {
        const isAllowed = callerAssigned.some(az => {
          const cleanAz = az.toLowerCase().replace(/zone/i, '').trim();
          const cleanFz = effectiveZoneFilter.toLowerCase().replace(/zone/i, '').trim();
          return effectiveZoneFilter.toLowerCase().includes(az.toLowerCase()) || 
                 az.toLowerCase().includes(effectiveZoneFilter.toLowerCase()) ||
                 (cleanAz && cleanFz && (cleanFz.includes(cleanAz) || cleanAz.includes(cleanFz)));
        });
        if (!isAllowed) {
          effectiveZoneFilter = callerZone;
        }
      } else {
        effectiveZoneFilter = callerZone;
      }
    }

    // Build unified UNION query
    const unionQuery = `
      WITH unified_transactions AS (
        -- 1. ICICI Payments
        SELECT 
          'icici_' || ip.id::text AS id,
          ip.tx_id,
          COALESCE(ip.upi_ref_no, ip.merchant_id, 'ICICI-UPI') AS reference_id,
          COALESCE(
            NULLIF(ip.rider_name, 'Rider'),
            r.customer_name,
            (SELECT rider_name FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(ip.mobile, '\\D', '', 'g'), 10) LIMIT 1),
            'Evegah Rider'
          ) AS rider_name,
          COALESCE(
            NULLIF(ip.mobile, ''),
            r.mobile,
            ''
          ) AS mobile,
          COALESCE(r.fare, CASE WHEN ip.amount >= 10 THEN (ip.amount - COALESCE(r.deposit, 5)) ELSE ip.amount END)::numeric AS rent_amount,
          COALESCE(r.deposit, CASE WHEN ip.amount >= 10 THEN 5 ELSE 0 END)::numeric AS deposit_amount,
          ip.amount::numeric AS amount,
          'Credit' AS type,
          CASE 
            WHEN UPPER(ip.status) = 'SUCCESS' THEN 'Successful'
            WHEN UPPER(ip.status) = 'PENDING' THEN 'Pending'
            ELSE 'Failed'
          END AS status,
          'ICICI UPI' AS payment_method,
          COALESCE(ip.purpose, 'Ride / Booking') AS purpose,
          COALESCE(
            NULLIF(r.pickup_zone, ''),
            NULLIF(r.drop_zone, ''),
            (SELECT zone FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(ip.mobile, '\\D', '', 'g'), 10) AND zone IS NOT NULL AND zone != '' ORDER BY created_at DESC LIMIT 1),
            (SELECT pickup_zone FROM reservations WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(ip.mobile, '\\D', '', 'g'), 10) AND pickup_zone IS NOT NULL AND pickup_zone != '' ORDER BY created_at DESC LIMIT 1),
            (SELECT zone FROM vehicles WHERE code = r.vehicle_number OR registration_number = r.vehicle_number LIMIT 1),
            (SELECT v.zone FROM vehicles v JOIN renters ren ON (v.code = ren.vehicle_id OR v.registration_number = ren.vehicle_id) WHERE ren.mobile LIKE '%' || RIGHT(REGEXP_REPLACE(ip.mobile, '\\D', '', 'g'), 10) AND v.zone IS NOT NULL AND v.zone != '' ORDER BY ren.created_at DESC LIMIT 1),
            'Gotri Zone'
          ) AS zone,
          ip.created_at
        FROM icici_payments ip
        LEFT JOIN reservations r ON (r.transaction_id = ip.tx_id OR r.reservation_id = ip.reservation_id)
        WHERE ip.mobile NOT LIKE '%1800%'
          AND ip.mobile NOT LIKE '%1820%'

        UNION ALL

        -- 2. PayU Payments
        SELECT 
          'payu_' || pp.id::text AS id,
          pp.tx_id,
          COALESCE(pp.payu_id, pp.bank_ref_num, pp.tx_id) AS reference_id,
          COALESCE(
            NULLIF(pp.rider_name, 'Rider'),
            r.customer_name,
            (SELECT rider_name FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(pp.mobile, '\\D', '', 'g'), 10) LIMIT 1),
            'Evegah Rider'
          ) AS rider_name,
          COALESCE(
            NULLIF(pp.mobile, ''),
            r.mobile,
            ''
          ) AS mobile,
          COALESCE(r.fare, pp.amount)::numeric AS rent_amount,
          COALESCE(r.deposit, 0)::numeric AS deposit_amount,
          pp.amount::numeric AS amount,
          'Credit' AS type,
          CASE 
            WHEN UPPER(pp.status) = 'SUCCESS' THEN 'Successful'
            WHEN UPPER(pp.status) = 'PENDING' THEN 'Pending'
            WHEN UPPER(pp.status) IN ('DROPPED', 'USER DROPPED') OR pp.error_message ILIKE '%dropped%' THEN 'User Dropped'
            ELSE 'Failed'
          END AS status,
          'PayU India' AS payment_method,
          COALESCE(pp.purpose, 'Ride Payment') AS purpose,
          COALESCE(r.pickup_zone, r.drop_zone, (SELECT zone FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(pp.mobile, '\\D', '', 'g'), 10) LIMIT 1), 'Gotri Zone') AS zone,
          pp.created_at
        FROM payu_payments pp
        LEFT JOIN reservations r ON (r.transaction_id = pp.tx_id OR r.reservation_id = pp.reservation_id)
        WHERE UPPER(pp.status) = 'SUCCESS'
          AND pp.status NOT IN ('Refund_Failed', 'Refunded', 'User Dropped', 'DROPPED', 'Dropped', 'Failed')
          AND COALESCE(pp.error_message, '') NOT ILIKE '%dropped%'
          AND pp.purpose NOT ILIKE '%refund%'
          AND pp.tx_id NOT LIKE 'REF-%'
          AND pp.mobile NOT LIKE '%1800%'
          AND pp.mobile NOT LIKE '%1820%'
          AND NOT (
            COALESCE(pp.rider_name, '') IN ('Rider', 'Evegah Rider')
            AND (pp.mobile LIKE '%1800%' OR pp.mobile LIKE '%1820%' OR pp.mobile = '')
          )

        UNION ALL

        -- 3. PhonePe Payments
        SELECT
          'phonepe_' || ph.id::text AS id,
          ph.tx_id,
          COALESCE(ph.phonepe_tx_id, ph.upi_ref_no, ph.tx_id) AS reference_id,
          COALESCE(
            NULLIF(ph.rider_name, 'Rider'),
            (SELECT rider_name FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(ph.mobile, '\\D', '', 'g'), 10) LIMIT 1),
            'Evegah Rider'
          ) AS rider_name,
          COALESCE(NULLIF(ph.mobile, ''), '') AS mobile,
          ph.amount::numeric AS rent_amount,
          0.00::numeric AS deposit_amount,
          ph.amount::numeric AS amount,
          'Credit' AS type,
          CASE 
            WHEN UPPER(ph.status) = 'SUCCESS' THEN 'Successful'
            WHEN UPPER(ph.status) = 'PENDING' THEN 'Pending'
            ELSE 'Failed'
          END AS status,
          'PhonePe' AS payment_method,
          COALESCE(ph.purpose, 'Ride Payment') AS purpose,
          COALESCE(
            (SELECT zone FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(ph.mobile, '\\D', '', 'g'), 10) AND zone IS NOT NULL AND zone != '' ORDER BY created_at DESC LIMIT 1),
            (SELECT pickup_zone FROM reservations WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(ph.mobile, '\\D', '', 'g'), 10) AND pickup_zone IS NOT NULL AND pickup_zone != '' ORDER BY created_at DESC LIMIT 1),
            'Gotri Zone'
          ) AS zone,
          ph.created_at
        FROM phonepe_payments ph
        WHERE ph.mobile NOT LIKE '%1800%'
          AND ph.mobile NOT LIKE '%1820%'

        UNION ALL

        -- 4. Wallet / Refund Transactions
        SELECT 
          'wallet_' || wt.id::text AS id,
          COALESCE(wt.transaction_id, 'TXN-W' || wt.id::text) AS tx_id,
          COALESCE(wt.transaction_id, 'WLT-' || wt.id::text) AS reference_id,
          COALESCE(
            (SELECT rider_name FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(wt.mobile, '\\D', '', 'g'), 10) LIMIT 1),
            (SELECT name FROM users WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(wt.mobile, '\\D', '', 'g'), 10) LIMIT 1),
            'Rider (' || wt.mobile || ')'
          ) AS rider_name,
          COALESCE(wt.mobile, '') AS mobile,
          CASE 
            WHEN wt.title ILIKE '%deposit%' OR wt.subtitle ILIKE '%deposit%' THEN 0.00
            ELSE wt.amount::numeric
          END AS rent_amount,
          CASE 
            WHEN wt.title ILIKE '%deposit%' OR wt.subtitle ILIKE '%deposit%' THEN wt.amount::numeric
            ELSE 0.00
          END AS deposit_amount,
          wt.amount::numeric AS amount,
          CASE 
            WHEN LOWER(wt.type) = 'debit' THEN 'Debit'
            ELSE 'Credit'
          END AS type,
          CASE 
            WHEN UPPER(wt.status) IN ('SUCCESS', 'SUCCESSFUL') THEN 'Successful'
            WHEN UPPER(wt.status) = 'PENDING' THEN 'Pending'
            ELSE 'Failed'
          END AS status,
          COALESCE(wt.payment_method, 'Wallet') AS payment_method,
          COALESCE(wt.title, wt.subtitle, 'Wallet Transaction') AS purpose,
          COALESCE((SELECT zone FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(wt.mobile, '\\D', '', 'g'), 10) LIMIT 1), 'Gotri Zone') AS zone,
          wt.created_at
        FROM wallet_transactions wt

        UNION ALL

        -- 5. Completed Deposit Refunds from Reservations
        SELECT 
          'refund_' || id::text AS id,
          COALESCE(refund_tx_id, 'REF-' || SUBSTRING(id::text, 1, 8)) AS tx_id,
          reservation_id AS reference_id,
          COALESCE(customer_name, 'Rider') AS rider_name,
          COALESCE(mobile, '') AS mobile,
          0.00::numeric AS rent_amount,
          COALESCE(refund_amount, deposit, 0)::numeric AS deposit_amount,
          COALESCE(refund_amount, deposit, 0)::numeric AS amount,
          'Debit' AS type,
          'Successful' AS status,
          COALESCE(refund_mode, 'PayU') AS payment_method,
          'Security Deposit Refund' AS purpose,
          COALESCE(
            NULLIF(pickup_zone, ''),
            NULLIF(drop_zone, ''),
            (SELECT zone FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(reservations.mobile, '\\D', '', 'g'), 10) AND zone IS NOT NULL AND zone != '' ORDER BY created_at DESC LIMIT 1),
            'Gotri Zone'
          ) AS zone,
          COALESCE(refund_date, returned_at, created_at) AS created_at
        FROM reservations
        WHERE deposit_status = 'Refunded' AND COALESCE(refund_amount, deposit, 0) > 0
          AND NOT EXISTS (
            SELECT 1 FROM wallet_transactions wt WHERE wt.transaction_id = reservations.refund_tx_id
          )

        UNION ALL

        -- 6. Direct / Cash / Offline Booking Payments
        SELECT
          'res_' || reservations.id::text AS id,
          COALESCE(reservations.cash_voucher_number, reservations.transaction_id, 'CSH-VCHR-' || SUBSTRING(reservations.id::text, 1, 8)) AS tx_id,
          COALESCE(reservations.cash_voucher_number, reservations.transaction_id, reservations.reservation_id) AS reference_id,
          COALESCE(reservations.customer_name, ren.rider_name, 'Rider') AS rider_name,
          COALESCE(reservations.mobile, ren.mobile, '') AS mobile,
          COALESCE(reservations.fare, ren.rent, 0)::numeric AS rent_amount,
          COALESCE(reservations.deposit, ren.deposit, 0)::numeric AS deposit_amount,
          COALESCE(NULLIF(reservations.total_payable, 0), NULLIF(ren.total, 0), (COALESCE(reservations.fare, ren.rent, 0) + COALESCE(reservations.deposit, ren.deposit, 0)), reservations.deposit, reservations.fare, 0)::numeric AS amount,
          'Credit' AS type,
          'Successful' AS status,
          CASE 
            WHEN reservations.payment_mode ILIKE '%cash%' THEN 'Cash'
            ELSE COALESCE(reservations.payment_mode, 'Cash')
          END AS payment_method,
          CASE 
            WHEN (COALESCE(reservations.fare, ren.rent, 0) > 0 AND COALESCE(reservations.deposit, ren.deposit, 0) > 0) THEN 'Ride Booking & Deposit'
            WHEN COALESCE(reservations.fare, ren.rent, 0) > 0 THEN 'Ride Booking (' || COALESCE(reservations.package_type, ren.package_name, 'Rental Plan') || ')'
            ELSE 'Security Deposit'
          END AS purpose,
          COALESCE(
            NULLIF(reservations.pickup_zone, ''),
            NULLIF(reservations.drop_zone, ''),
            ren.zone,
            'Gotri Zone'
          ) AS zone,
          reservations.created_at
        FROM reservations
        LEFT JOIN LATERAL (
          SELECT rent, deposit, total, rider_name, mobile, zone, package_name
          FROM renters r
          WHERE r.mobile LIKE '%' || RIGHT(REGEXP_REPLACE(reservations.mobile, '\\D', '', 'g'), 10)
          ORDER BY r.created_at DESC
          LIMIT 1
        ) ren ON true
        WHERE reservations.payment_status = 'Paid' 
          AND (COALESCE(reservations.fare, 0) > 0 OR COALESCE(reservations.deposit, 0) > 0 OR COALESCE(reservations.total_payable, 0) > 0 OR COALESCE(ren.rent, 0) > 0 OR COALESCE(ren.deposit, 0) > 0)
          AND (reservations.payment_mode IS NULL OR reservations.payment_mode NOT IN ('PayU', 'PayU India', 'ICICI UPI', 'UPI', 'Wallet', 'Evegah Wallet', 'PhonePe'))
          AND NOT EXISTS (
            SELECT 1 FROM payu_payments pp 
            WHERE (pp.tx_id = reservations.transaction_id 
               OR pp.reservation_id = reservations.id::text 
               OR pp.reservation_id = reservations.reservation_id)
              AND UPPER(pp.status) = 'SUCCESS'
          )
          AND NOT EXISTS (
            SELECT 1 FROM icici_payments ip 
            WHERE (ip.tx_id = reservations.transaction_id 
               OR ip.reservation_id = reservations.id::text 
               OR ip.reservation_id = reservations.reservation_id)
              AND UPPER(ip.status) = 'SUCCESS'
          )
          AND NOT EXISTS (
            SELECT 1 FROM phonepe_payments ph 
            WHERE (ph.tx_id = reservations.transaction_id 
               OR ph.reservation_id = reservations.id::text 
               OR ph.reservation_id = reservations.reservation_id)
              AND UPPER(ph.status) = 'SUCCESS'
          )
          AND NOT EXISTS (
            SELECT 1 FROM wallet_transactions wt 
            WHERE wt.transaction_id = reservations.transaction_id
          )

        UNION ALL

        -- 7. Direct / Cash Renter Registration Payments
        SELECT
          'rnt_' || renters.id::text AS id,
          COALESCE(renters.rider_id, 'CSH-REG-' || SUBSTRING(renters.id::text, 1, 8)) AS tx_id,
          COALESCE(renters.rider_id, renters.id::text) AS reference_id,
          COALESCE(renters.rider_name, 'Rider') AS rider_name,
          COALESCE(renters.mobile, '') AS mobile,
          COALESCE(renters.rent, 0)::numeric AS rent_amount,
          COALESCE(renters.deposit, 0)::numeric AS deposit_amount,
          COALESCE(NULLIF(renters.total, 0), (COALESCE(renters.rent, 0) + COALESCE(renters.deposit, 0)), renters.deposit, renters.rent, 0)::numeric AS amount,
          'Credit' AS type,
          'Successful' AS status,
          'Cash' AS payment_method,
          CASE 
            WHEN COALESCE(renters.rent, 0) > 0 AND COALESCE(renters.deposit, 0) > 0 THEN 'Counter Registration & Deposit'
            WHEN COALESCE(renters.rent, 0) > 0 THEN 'Counter Rental Plan'
            ELSE 'Counter Security Deposit'
          END AS purpose,
          COALESCE(NULLIF(renters.zone, ''), 'Gotri Zone') AS zone,
          renters.created_at
        FROM renters
        WHERE (COALESCE(renters.rent, 0) > 0 OR COALESCE(renters.deposit, 0) > 0 OR COALESCE(renters.total, 0) > 0)
          AND NOT EXISTS (
            SELECT 1 FROM payu_payments pp 
            WHERE pp.mobile LIKE '%' || RIGHT(REGEXP_REPLACE(renters.mobile, '\\D', '', 'g'), 10)
              AND UPPER(pp.status) = 'SUCCESS'
          )
          AND NOT EXISTS (
            SELECT 1 FROM icici_payments ip 
            WHERE ip.mobile LIKE '%' || RIGHT(REGEXP_REPLACE(renters.mobile, '\\D', '', 'g'), 10)
              AND UPPER(ip.status) = 'SUCCESS'
          )
          AND NOT EXISTS (
            SELECT 1 FROM reservations res
            WHERE res.mobile LIKE '%' || RIGHT(REGEXP_REPLACE(renters.mobile, '\\D', '', 'g'), 10)
              AND res.payment_status = 'Paid'
          )
      )
      SELECT * FROM unified_transactions
    `;

    // Query all records for accurate KPI metrics
    const allRecordsRes = await db.query(unionQuery);
    const rawAllRecords = allRecordsRes.rows;

    // Deduplicate transactions:
    // 1. If a transaction/booking is Successful, suppress any Pending attempts for it.
    // 2. Collapse rapid repeated Pending attempts for the same mobile and amount to 1 single pending record.
    const successfulKeys = new Set();
    rawAllRecords.forEach(rec => {
      if ((rec.status || '').toLowerCase() === 'successful') {
        if (rec.reference_id && rec.reference_id !== 'ICICI-UPI') successfulKeys.add(rec.reference_id);
        if (rec.tx_id) successfulKeys.add(rec.tx_id);
        const cleanMob = (rec.mobile || '').replace(/\D/g, '').slice(-10);
        if (cleanMob) {
          const dateDay = new Date(rec.created_at).toISOString().slice(0, 10);
          successfulKeys.add(`${cleanMob}_${parseFloat(rec.amount)}_${dateDay}`);
        }
      }
    });

    const seenPendingKeys = new Set();
    const allRecords = [];

    for (const rec of rawAllRecords) {
      const st = (rec.status || '').toLowerCase();
      const cleanMob = (rec.mobile || '').replace(/\D/g, '').slice(-10);
      const dateDay = new Date(rec.created_at).toISOString().slice(0, 10);
      const mobAmtDayKey = `${cleanMob}_${parseFloat(rec.amount)}_${dateDay}`;

      if (st === 'pending') {
        // If payment was completed successfully, hide redundant pending records
        if (successfulKeys.has(rec.reference_id) || successfulKeys.has(rec.tx_id) || successfulKeys.has(mobAmtDayKey)) {
          continue;
        }
        // If multiple pending attempts exist for same mobile and amount within same day, keep only the latest single one
        if (cleanMob && seenPendingKeys.has(mobAmtDayKey)) {
          continue;
        }
        seenPendingKeys.add(mobAmtDayKey);
      }
      allRecords.push(rec);
    }

    // Filter records with role/zone scope and applied filters
    let filtered = allRecords.filter(rec => {
      if (search) {
        const q = search;
        const name = (rec.rider_name || '').toLowerCase();
        const mob = (rec.mobile || '').toLowerCase();
        const tx = (rec.tx_id || '').toLowerCase();
        const ref = (rec.reference_id || '').toLowerCase();
        const pm = (rec.payment_method || '').toLowerCase();
        if (!name.includes(q) && !mob.includes(q) && !tx.includes(q) && !ref.includes(q) && !pm.includes(q)) {
          return false;
        }
      }

      if (typeFilter !== 'all' && (rec.type || '').toLowerCase() !== typeFilter) {
        return false;
      }

      if (statusFilter !== 'all' && (rec.status || '').toLowerCase() !== statusFilter) {
        return false;
      }

      if (req.query.method && req.query.method !== 'all') {
        const m = req.query.method.toLowerCase();
        const pm = (rec.payment_method || '').toLowerCase();
        if (m === 'cash' && !(pm.includes('cash') || pm.includes('counter'))) return false;
        if (m === 'payu' && !pm.includes('payu')) return false;
        if (m === 'icici' && !pm.includes('icici')) return false;
        if (m === 'phonepe' && !pm.includes('phonepe')) return false;
        if (m === 'wallet' && !pm.includes('wallet')) return false;
      }

      if (effectiveZoneFilter && effectiveZoneFilter.toLowerCase() !== 'all' && effectiveZoneFilter.toLowerCase() !== 'all zones') {
        const allowedZones = effectiveZoneFilter.split(',').map(z => z.trim().toLowerCase()).filter(Boolean);
        if (allowedZones.length > 0) {
          const recZone = (rec.zone || 'Gotri Zone').toLowerCase().trim();
          const cleanRz = recZone.replace(/zone/i, '').trim();
          const matched = allowedZones.some(az => {
            const cleanAz = az.replace(/zone/i, '').trim();
            return recZone.includes(az) || az.includes(recZone) || (cleanAz && cleanRz && (cleanRz.includes(cleanAz) || cleanAz.includes(cleanRz)));
          });
          if (!matched) return false;
        }
      }

      if (fromDate) {
        const recDate = new Date(rec.created_at);
        const startDay = new Date(fromDate);
        startDay.setHours(0, 0, 0, 0);
        if (recDate < startDay) return false;
      }

      if (toDate) {
        const recDate = new Date(rec.created_at);
        const endDay = new Date(toDate);
        endDay.setHours(23, 59, 59, 999);
        if (recDate > endDay) return false;
      }

      return true;
    });

    // Compute live KPI metrics over filtered records (strictly scoped to zone, date range, and filters)
    let totalCredit = 0;
    let totalDebit = 0;
    let successfulCount = 0;
    let pendingCount = 0;
    let failedCount = 0;

    filtered.forEach(rec => {
      const amt = parseFloat(rec.amount) || 0;
      const st = (rec.status || '').toLowerCase();
      const tp = (rec.type || '').toLowerCase();

      if (st === 'successful') {
        successfulCount++;
        if (tp === 'credit') {
          totalCredit += amt;
        } else if (tp === 'debit') {
          totalDebit += amt;
        }
      } else if (st === 'pending') {
        pendingCount++;
      } else {
        failedCount++;
      }
    });

    const netBalance = totalCredit - totalDebit;

    // Sort by created_at DESC
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    res.json({
      status: 'success',
      kpis: {
        total_credit: Math.round(totalCredit * 100) / 100,
        total_debit: Math.round(totalDebit * 100) / 100,
        net_balance: Math.round(netBalance * 100) / 100,
        total_transactions: filtered.length,
        successful_count: successfulCount,
        pending_count: pendingCount,
        failed_count: failedCount
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      },
      data: paginated
    });
  } catch (err) {
    console.error('Error fetching payment history:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * GET /api/payments/cash-collection
 * Dedicated Cash Collection Report & Vouchers Ledger
 */
router.get('/cash-collection', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim().toLowerCase();
    const zone = (req.query.zone || '').trim();
    const fromDate = req.query.from_date;
    const toDate = req.query.to_date;

    let whereClause = `WHERE (payment_mode ILIKE '%cash%' OR cash_voucher_number IS NOT NULL)`;
    const params = [];

    if (zone && zone !== 'All Zones') {
      params.push(`%${zone}%`);
      whereClause += ` AND (pickup_zone ILIKE $${params.length} OR drop_zone ILIKE $${params.length})`;
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      whereClause += ` AND (
        customer_name ILIKE $${idx} OR 
        mobile ILIKE $${idx} OR 
        reservation_id ILIKE $${idx} OR 
        cash_voucher_number ILIKE $${idx} OR 
        transaction_id ILIKE $${idx}
      )`;
    }

    if (fromDate) {
      params.push(fromDate);
      whereClause += ` AND created_at >= $${params.length}::date`;
    }

    if (toDate) {
      params.push(toDate);
      whereClause += ` AND created_at <= ($${params.length}::date + interval '1 day')`;
    }

    // Aggregates for KPI cards
    const summaryRes = await db.query(`
      SELECT
        COUNT(*)::int AS total_vouchers,
        COALESCE(SUM(COALESCE(total_payable, (COALESCE(fare, 0) + COALESCE(deposit, 0)))), 0)::numeric AS total_cash_collected,
        COALESCE(SUM(CASE WHEN created_at::date = CURRENT_DATE THEN COALESCE(total_payable, (COALESCE(fare, 0) + COALESCE(deposit, 0))) ELSE 0 END), 0)::numeric AS today_cash_collected,
        COALESCE(SUM(CASE WHEN created_at >= DATE_TRUNC('month', CURRENT_DATE) THEN COALESCE(total_payable, (COALESCE(fare, 0) + COALESCE(deposit, 0))) ELSE 0 END), 0)::numeric AS this_month_cash_collected
      FROM reservations
      ${whereClause}
    `, params);

    const summary = summaryRes.rows[0] || {
      total_vouchers: 0,
      total_cash_collected: 0,
      today_cash_collected: 0,
      this_month_cash_collected: 0
    };

    // List of vouchers
    const listRes = await db.query(`
      SELECT
        id,
        reservation_id,
        COALESCE(cash_voucher_number, transaction_id, 'CSH-VCHR-' || SUBSTRING(id::text, 1, 8)) AS voucher_number,
        transaction_id,
        customer_name AS rider_name,
        mobile,
        fare::numeric,
        deposit::numeric,
        COALESCE(total_payable, (COALESCE(fare, 0) + COALESCE(deposit, 0)))::numeric AS total_amount,
        payment_mode,
        payment_status,
        status,
        package_type,
        vehicle_model,
        pickup_zone,
        drop_zone,
        COALESCE(cash_collected_by, 'Counter Cashier') AS collected_by,
        created_at
      FROM reservations
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `, params);

    res.json({
      status: 'success',
      summary: {
        total_vouchers: parseInt(summary.total_vouchers) || 0,
        total_cash_collected: parseFloat(summary.total_cash_collected) || 0,
        today_cash_collected: parseFloat(summary.today_cash_collected) || 0,
        this_month_cash_collected: parseFloat(summary.this_month_cash_collected) || 0
      },
      pagination: {
        page,
        limit,
        total: parseInt(summary.total_vouchers) || 0,
        pages: Math.ceil((parseInt(summary.total_vouchers) || 0) / limit)
      },
      data: listRes.rows
    });
  } catch (err) {
    console.error('Error fetching cash collection report:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Helper to delete a single transaction by composite id
const deleteSingleTransaction = async (compositeId) => {
  const str = String(compositeId || '');
  if (str.startsWith('icici_')) {
    const rawId = str.replace('icici_', '');
    return db.query('DELETE FROM icici_payments WHERE id::text = $1', [rawId]).catch(() => ({ rowCount: 0 }));
  } else if (str.startsWith('payu_')) {
    const rawId = str.replace('payu_', '');
    return db.query('DELETE FROM payu_payments WHERE id::text = $1', [rawId]).catch(() => ({ rowCount: 0 }));
  } else if (str.startsWith('phonepe_')) {
    const rawId = str.replace('phonepe_', '');
    return db.query('DELETE FROM phonepe_payments WHERE id::text = $1', [rawId]).catch(() => ({ rowCount: 0 }));
  } else if (str.startsWith('wallet_')) {
    const rawId = str.replace('wallet_', '');
    return db.query('DELETE FROM wallet_transactions WHERE id::text = $1', [rawId]).catch(() => ({ rowCount: 0 }));
  } else if (str.startsWith('refund_')) {
    const rawId = str.replace('refund_', '');
    return db.query("UPDATE reservations SET deposit_status = 'Dismissed', refund_amount = 0 WHERE id::text = $1 OR reservation_id = $1", [rawId]).catch(() => ({ rowCount: 0 }));
  } else if (str.startsWith('res_')) {
    const rawId = str.replace('res_', '');
    return db.query("UPDATE reservations SET payment_status = 'Cancelled' WHERE id::text = $1 OR reservation_id = $1", [rawId]).catch(() => ({ rowCount: 0 }));
  } else {
    await db.query('DELETE FROM payu_payments WHERE id::text = $1 OR tx_id = $1', [str]).catch(() => {});
    await db.query('DELETE FROM icici_payments WHERE id::text = $1 OR tx_id = $1', [str]).catch(() => {});
    await db.query('DELETE FROM phonepe_payments WHERE id::text = $1 OR tx_id = $1', [str]).catch(() => {});
    await db.query('DELETE FROM wallet_transactions WHERE id::text = $1 OR transaction_id = $1', [str]).catch(() => {});
    return { rowCount: 1 };
  }
};

/**
 * DELETE /api/payments/history
 * Bulk delete payment transactions
 */
router.delete('/', async (req, res) => {
  const ids = req.body?.ids || req.body?.data?.ids || (req.query?.ids ? String(req.query.ids).split(',') : []);
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ status: 'error', message: 'No transaction IDs provided' });
  }

  try {
    let affected = 0;
    for (const id of ids) {
      const resDel = await deleteSingleTransaction(id);
      affected += resDel?.rowCount || 0;
    }

    res.json({
      status: 'success',
      message: `Successfully deleted ${ids.length} transaction record(s).`,
      affected
    });
  } catch (err) {
    console.error('Error deleting transactions:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * DELETE /api/payments/history/:id
 * Delete a single payment transaction
 */
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await deleteSingleTransaction(id);
    res.json({
      status: 'success',
      message: 'Transaction deleted successfully.'
    });
  } catch (err) {
    console.error('Error deleting transaction:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * GET /api/payments/history/export
 * Export all unified payment transactions and deposit history as CSV or JSON
 */
router.get('/export', async (req, res) => {
  try {
    const format = (req.query.format || 'csv').toLowerCase();
    const search = (req.query.search || '').trim().toLowerCase();
    const typeFilter = (req.query.type || 'all').toLowerCase();
    const statusFilter = (req.query.status || 'all').toLowerCase();
    const rawZoneFilter = (req.query.zone || '').trim();
    const fromDate = req.query.from_date;
    const toDate = req.query.to_date;

    // Role-based and Zone-based access control
    const callerRole = (req.headers['x-user-role'] || (req.user && req.user.role) || '').toLowerCase();
    const callerZone = (req.headers['x-user-zone'] || (req.user && req.user.zone) || '').trim();
    const isGlobalAdmin = callerRole.includes('super_admin') || 
                          callerRole.includes('super admin') || 
                          callerRole.includes('platform admin') || 
                          callerRole === 'admin' ||
                          callerRole === 'system';

    let effectiveZoneFilter = rawZoneFilter;
    if (!isGlobalAdmin && callerZone && callerZone.toLowerCase() !== 'all' && callerZone.toLowerCase() !== 'all zones') {
      const callerAssigned = callerZone.split(',').map(z => z.trim()).filter(Boolean);
      if (effectiveZoneFilter && effectiveZoneFilter.toLowerCase() !== 'all' && effectiveZoneFilter.toLowerCase() !== 'all zones') {
        const isAllowed = callerAssigned.some(az => {
          const cleanAz = az.toLowerCase().replace(/zone/i, '').trim();
          const cleanFz = effectiveZoneFilter.toLowerCase().replace(/zone/i, '').trim();
          return effectiveZoneFilter.toLowerCase().includes(az.toLowerCase()) || 
                 az.toLowerCase().includes(effectiveZoneFilter.toLowerCase()) ||
                 (cleanAz && cleanFz && (cleanFz.includes(cleanAz) || cleanAz.includes(cleanFz)));
        });
        if (!isAllowed) {
          effectiveZoneFilter = callerZone;
        }
      } else {
        effectiveZoneFilter = callerZone;
      }
    }
    const query = `
      WITH unified_transactions AS (
        -- 1. ICICI Payments
        SELECT 
          'icici_' || ip.id::text AS id,
          ip.tx_id,
          COALESCE(ip.upi_ref_no, ip.merchant_id, 'ICICI-UPI') AS reference_id,
          COALESCE(
            NULLIF(ip.rider_name, 'Rider'),
            r.customer_name,
            (SELECT rider_name FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(ip.mobile, '\\D', '', 'g'), 10) LIMIT 1),
            'Evegah Rider'
          ) AS rider_name,
          COALESCE(NULLIF(ip.mobile, ''), r.mobile, '') AS mobile,
          COALESCE(r.fare, CASE WHEN ip.amount >= 10 THEN (ip.amount - COALESCE(r.deposit, 5)) ELSE ip.amount END)::numeric AS rent_amount,
          COALESCE(r.deposit, CASE WHEN ip.amount >= 10 THEN 5 ELSE 0 END)::numeric AS deposit_amount,
          ip.amount::numeric AS amount,
          'Credit' AS type,
          CASE 
            WHEN UPPER(ip.status) = 'SUCCESS' THEN 'Successful'
            WHEN UPPER(ip.status) = 'PENDING' THEN 'Pending'
            ELSE 'Failed'
          END AS status,
          'ICICI UPI' AS payment_method,
          COALESCE(ip.purpose, 'Ride / Booking') AS purpose,
          COALESCE(
            NULLIF(r.pickup_zone, ''),
            NULLIF(r.drop_zone, ''),
            (SELECT zone FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(ip.mobile, '\\D', '', 'g'), 10) AND zone IS NOT NULL AND zone != '' ORDER BY created_at DESC LIMIT 1),
            (SELECT pickup_zone FROM reservations WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(ip.mobile, '\\D', '', 'g'), 10) AND pickup_zone IS NOT NULL AND pickup_zone != '' ORDER BY created_at DESC LIMIT 1),
            (SELECT zone FROM vehicles WHERE code = r.vehicle_number OR registration_number = r.vehicle_number LIMIT 1),
            (SELECT v.zone FROM vehicles v JOIN renters ren ON (v.code = ren.vehicle_id OR v.registration_number = ren.vehicle_id) WHERE ren.mobile LIKE '%' || RIGHT(REGEXP_REPLACE(ip.mobile, '\\D', '', 'g'), 10) AND v.zone IS NOT NULL AND v.zone != '' ORDER BY ren.created_at DESC LIMIT 1),
            'Gotri Zone'
          ) AS zone,
          ip.created_at
        FROM icici_payments ip
        LEFT JOIN reservations r ON (r.transaction_id = ip.tx_id OR r.reservation_id = ip.reservation_id)
        WHERE ip.mobile NOT LIKE '%1800%'
          AND ip.mobile NOT LIKE '%1820%'

        UNION ALL

        -- 2. PayU Payments
        SELECT 
          'payu_' || pp.id::text AS id,
          pp.tx_id,
          COALESCE(pp.payu_id, pp.bank_ref_num, pp.tx_id) AS reference_id,
          COALESCE(
            NULLIF(pp.rider_name, 'Rider'),
            r.customer_name,
            (SELECT rider_name FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(pp.mobile, '\\D', '', 'g'), 10) LIMIT 1),
            'Evegah Rider'
          ) AS rider_name,
          COALESCE(NULLIF(pp.mobile, ''), r.mobile, '') AS mobile,
          COALESCE(r.fare, pp.amount)::numeric AS rent_amount,
          COALESCE(r.deposit, 0)::numeric AS deposit_amount,
          pp.amount::numeric AS amount,
          'Credit' AS type,
          CASE 
            WHEN UPPER(pp.status) = 'SUCCESS' THEN 'Successful'
            WHEN UPPER(pp.status) = 'PENDING' THEN 'Pending'
            WHEN UPPER(pp.status) IN ('DROPPED', 'USER DROPPED') OR pp.error_message ILIKE '%dropped%' THEN 'User Dropped'
            ELSE 'Failed'
          END AS status,
          'PayU India' AS payment_method,
          COALESCE(pp.purpose, 'Ride Payment') AS purpose,
          COALESCE(r.pickup_zone, r.drop_zone, (SELECT zone FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(pp.mobile, '\\D', '', 'g'), 10) LIMIT 1), 'Gotri Zone') AS zone,
          pp.created_at
        FROM payu_payments pp
        LEFT JOIN reservations r ON (r.transaction_id = pp.tx_id OR r.reservation_id = pp.reservation_id)
        WHERE UPPER(pp.status) = 'SUCCESS'
          AND pp.status NOT IN ('Refund_Failed', 'Refunded', 'User Dropped', 'DROPPED', 'Dropped', 'Failed')
          AND COALESCE(pp.error_message, '') NOT ILIKE '%dropped%'
          AND pp.purpose NOT ILIKE '%refund%'
          AND pp.tx_id NOT LIKE 'REF-%'
          AND pp.mobile NOT LIKE '%1800%'
          AND pp.mobile NOT LIKE '%1820%'
          AND NOT (
            COALESCE(pp.rider_name, '') IN ('Rider', 'Evegah Rider')
            AND (pp.mobile LIKE '%1800%' OR pp.mobile LIKE '%1820%' OR pp.mobile = '')
          )

        UNION ALL

        -- 3. PhonePe Payments
        SELECT
          'phonepe_' || ph.id::text AS id,
          ph.tx_id,
          COALESCE(ph.phonepe_tx_id, ph.upi_ref_no, ph.tx_id) AS reference_id,
          COALESCE(
            NULLIF(ph.rider_name, 'Rider'),
            (SELECT rider_name FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(ph.mobile, '\\D', '', 'g'), 10) LIMIT 1),
            'Evegah Rider'
          ) AS rider_name,
          COALESCE(NULLIF(ph.mobile, ''), '') AS mobile,
          ph.amount::numeric AS rent_amount,
          0.00::numeric AS deposit_amount,
          ph.amount::numeric AS amount,
          'Credit' AS type,
          CASE 
            WHEN UPPER(ph.status) = 'SUCCESS' THEN 'Successful'
            WHEN UPPER(ph.status) = 'PENDING' THEN 'Pending'
            ELSE 'Failed'
          END AS status,
          'PhonePe' AS payment_method,
          COALESCE(ph.purpose, 'Ride Payment') AS purpose,
          COALESCE(
            (SELECT zone FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(ph.mobile, '\\D', '', 'g'), 10) AND zone IS NOT NULL AND zone != '' ORDER BY created_at DESC LIMIT 1),
            (SELECT pickup_zone FROM reservations WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(ph.mobile, '\\D', '', 'g'), 10) AND pickup_zone IS NOT NULL AND pickup_zone != '' ORDER BY created_at DESC LIMIT 1),
            'Gotri Zone'
          ) AS zone,
          ph.created_at
        FROM phonepe_payments ph
        WHERE ph.mobile NOT LIKE '%1800%'
          AND ph.mobile NOT LIKE '%1820%'

        UNION ALL

        -- 4. Wallet / Refund Transactions
        SELECT 
          'wallet_' || wt.id::text AS id,
          COALESCE(wt.transaction_id, 'TXN-W' || wt.id::text) AS tx_id,
          COALESCE(wt.transaction_id, 'WLT-' || wt.id::text) AS reference_id,
          COALESCE(
            (SELECT rider_name FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(wt.mobile, '\\D', '', 'g'), 10) LIMIT 1),
            (SELECT name FROM users WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(wt.mobile, '\\D', '', 'g'), 10) LIMIT 1),
            'Rider (' || wt.mobile || ')'
          ) AS rider_name,
          COALESCE(wt.mobile, '') AS mobile,
          CASE 
            WHEN wt.title ILIKE '%deposit%' OR wt.subtitle ILIKE '%deposit%' THEN 0.00
            ELSE wt.amount::numeric
          END AS rent_amount,
          CASE 
            WHEN wt.title ILIKE '%deposit%' OR wt.subtitle ILIKE '%deposit%' THEN wt.amount::numeric
            ELSE 0.00
          END AS deposit_amount,
          wt.amount::numeric AS amount,
          CASE 
            WHEN LOWER(wt.type) = 'debit' THEN 'Debit'
            ELSE 'Credit'
          END AS type,
          CASE 
            WHEN UPPER(wt.status) IN ('SUCCESS', 'SUCCESSFUL') THEN 'Successful'
            WHEN UPPER(wt.status) = 'PENDING' THEN 'Pending'
            ELSE 'Failed'
          END AS status,
          COALESCE(wt.payment_method, 'Wallet') AS payment_method,
          COALESCE(wt.title, wt.subtitle, 'Wallet Transaction') AS purpose,
          COALESCE((SELECT zone FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(wt.mobile, '\\D', '', 'g'), 10) LIMIT 1), 'Gotri Zone') AS zone,
          wt.created_at
        FROM wallet_transactions wt

        UNION ALL

        -- 5. Completed Deposit Refunds from Reservations
        SELECT 
          'refund_' || id::text AS id,
          COALESCE(refund_tx_id, 'REF-' || SUBSTRING(id::text, 1, 8)) AS tx_id,
          reservation_id AS reference_id,
          COALESCE(customer_name, 'Rider') AS rider_name,
          COALESCE(mobile, '') AS mobile,
          0.00::numeric AS rent_amount,
          COALESCE(refund_amount, deposit, 0)::numeric AS deposit_amount,
          COALESCE(refund_amount, deposit, 0)::numeric AS amount,
          'Debit' AS type,
          'Successful' AS status,
          COALESCE(refund_mode, 'PayU') AS payment_method,
          'Security Deposit Refund' AS purpose,
          COALESCE(
            NULLIF(pickup_zone, ''),
            NULLIF(drop_zone, ''),
            (SELECT zone FROM renters WHERE mobile LIKE '%' || RIGHT(REGEXP_REPLACE(reservations.mobile, '\\D', '', 'g'), 10) AND zone IS NOT NULL AND zone != '' ORDER BY created_at DESC LIMIT 1),
            'Gotri Zone'
          ) AS zone,
          COALESCE(refund_date, returned_at, created_at) AS created_at
        FROM reservations
        WHERE deposit_status = 'Refunded' AND COALESCE(refund_amount, deposit, 0) > 0
          AND NOT EXISTS (
            SELECT 1 FROM wallet_transactions wt WHERE wt.transaction_id = reservations.refund_tx_id
          )

        UNION ALL

        -- 6. Direct / Cash / Offline Booking Payments
        SELECT
          'res_' || reservations.id::text AS id,
          COALESCE(reservations.cash_voucher_number, reservations.transaction_id, 'CSH-VCHR-' || SUBSTRING(reservations.id::text, 1, 8)) AS tx_id,
          COALESCE(reservations.cash_voucher_number, reservations.transaction_id, reservations.reservation_id) AS reference_id,
          COALESCE(reservations.customer_name, ren.rider_name, 'Rider') AS rider_name,
          COALESCE(reservations.mobile, ren.mobile, '') AS mobile,
          COALESCE(reservations.fare, ren.rent, 0)::numeric AS rent_amount,
          COALESCE(reservations.deposit, ren.deposit, 0)::numeric AS deposit_amount,
          COALESCE(NULLIF(reservations.total_payable, 0), NULLIF(ren.total, 0), (COALESCE(reservations.fare, ren.rent, 0) + COALESCE(reservations.deposit, ren.deposit, 0)), reservations.deposit, reservations.fare, 0)::numeric AS amount,
          'Credit' AS type,
          'Successful' AS status,
          CASE 
            WHEN reservations.payment_mode ILIKE '%cash%' THEN 'Cash'
            ELSE COALESCE(reservations.payment_mode, 'Cash')
          END AS payment_method,
          CASE 
            WHEN (COALESCE(reservations.fare, ren.rent, 0) > 0 AND COALESCE(reservations.deposit, ren.deposit, 0) > 0) THEN 'Ride Booking & Deposit'
            WHEN COALESCE(reservations.fare, ren.rent, 0) > 0 THEN 'Ride Booking (' || COALESCE(reservations.package_type, ren.package_name, 'Rental Plan') || ')'
            ELSE 'Security Deposit'
          END AS purpose,
          COALESCE(
            NULLIF(reservations.pickup_zone, ''),
            NULLIF(reservations.drop_zone, ''),
            ren.zone,
            'Gotri Zone'
          ) AS zone,
          reservations.created_at
        FROM reservations
        LEFT JOIN LATERAL (
          SELECT rent, deposit, total, rider_name, mobile, zone, package_name
          FROM renters r
          WHERE r.mobile LIKE '%' || RIGHT(REGEXP_REPLACE(reservations.mobile, '\\D', '', 'g'), 10)
          ORDER BY r.created_at DESC
          LIMIT 1
        ) ren ON true
        WHERE reservations.payment_status = 'Paid' 
          AND (COALESCE(reservations.fare, 0) > 0 OR COALESCE(reservations.deposit, 0) > 0 OR COALESCE(reservations.total_payable, 0) > 0 OR COALESCE(ren.rent, 0) > 0 OR COALESCE(ren.deposit, 0) > 0)
          AND (reservations.payment_mode IS NULL OR reservations.payment_mode NOT IN ('PayU', 'PayU India', 'ICICI UPI', 'UPI', 'Wallet', 'Evegah Wallet', 'PhonePe'))
          AND NOT EXISTS (
            SELECT 1 FROM payu_payments pp 
            WHERE (pp.tx_id = reservations.transaction_id 
               OR pp.reservation_id = reservations.id::text 
               OR pp.reservation_id = reservations.reservation_id)
              AND UPPER(pp.status) = 'SUCCESS'
          )
          AND NOT EXISTS (
            SELECT 1 FROM icici_payments ip 
            WHERE (ip.tx_id = reservations.transaction_id 
               OR ip.reservation_id = reservations.id::text 
               OR ip.reservation_id = reservations.reservation_id)
              AND UPPER(ip.status) = 'SUCCESS'
          )
          AND NOT EXISTS (
            SELECT 1 FROM phonepe_payments ph 
            WHERE (ph.tx_id = reservations.transaction_id 
               OR ph.reservation_id = reservations.id::text 
               OR ph.reservation_id = reservations.reservation_id)
              AND UPPER(ph.status) = 'SUCCESS'
          )
          AND NOT EXISTS (
            SELECT 1 FROM wallet_transactions wt 
            WHERE wt.transaction_id = reservations.transaction_id
          )

        UNION ALL

        -- 7. Direct / Cash Renter Registration Payments
        SELECT
          'rnt_' || renters.id::text AS id,
          COALESCE(renters.rider_id, 'CSH-REG-' || SUBSTRING(renters.id::text, 1, 8)) AS tx_id,
          COALESCE(renters.rider_id, renters.id::text) AS reference_id,
          COALESCE(renters.rider_name, 'Rider') AS rider_name,
          COALESCE(renters.mobile, '') AS mobile,
          COALESCE(renters.rent, 0)::numeric AS rent_amount,
          COALESCE(renters.deposit, 0)::numeric AS deposit_amount,
          COALESCE(NULLIF(renters.total, 0), (COALESCE(renters.rent, 0) + COALESCE(renters.deposit, 0)), renters.deposit, renters.rent, 0)::numeric AS amount,
          'Credit' AS type,
          'Successful' AS status,
          'Cash' AS payment_method,
          CASE 
            WHEN COALESCE(renters.rent, 0) > 0 AND COALESCE(renters.deposit, 0) > 0 THEN 'Counter Registration & Deposit'
            WHEN COALESCE(renters.rent, 0) > 0 THEN 'Counter Rental Plan'
            ELSE 'Counter Security Deposit'
          END AS purpose,
          COALESCE(NULLIF(renters.zone, ''), 'Gotri Zone') AS zone,
          renters.created_at
        FROM renters
        WHERE (COALESCE(renters.rent, 0) > 0 OR COALESCE(renters.deposit, 0) > 0 OR COALESCE(renters.total, 0) > 0)
          AND NOT EXISTS (
            SELECT 1 FROM payu_payments pp 
            WHERE pp.mobile LIKE '%' || RIGHT(REGEXP_REPLACE(renters.mobile, '\\D', '', 'g'), 10)
              AND UPPER(pp.status) = 'SUCCESS'
          )
          AND NOT EXISTS (
            SELECT 1 FROM icici_payments ip 
            WHERE ip.mobile LIKE '%' || RIGHT(REGEXP_REPLACE(renters.mobile, '\\D', '', 'g'), 10)
              AND UPPER(ip.status) = 'SUCCESS'
          )
          AND NOT EXISTS (
            SELECT 1 FROM reservations res
            WHERE res.mobile LIKE '%' || RIGHT(REGEXP_REPLACE(renters.mobile, '\\D', '', 'g'), 10)
              AND res.payment_status = 'Paid'
          )
      )
      SELECT * FROM unified_transactions ORDER BY created_at DESC;
    `;

    const txRes = await db.query(query);
    const rawRows = txRes.rows;

    const rows = rawRows.filter(rec => {
      if (search) {
        const q = search;
        const name = (rec.rider_name || '').toLowerCase();
        const mob = (rec.mobile || '').toLowerCase();
        const tx = (rec.tx_id || '').toLowerCase();
        const ref = (rec.reference_id || '').toLowerCase();
        const pm = (rec.payment_method || '').toLowerCase();
        if (!name.includes(q) && !mob.includes(q) && !tx.includes(q) && !ref.includes(q) && !pm.includes(q)) {
          return false;
        }
      }

      if (typeFilter !== 'all' && (rec.type || '').toLowerCase() !== typeFilter) {
        return false;
      }

      if (statusFilter !== 'all' && (rec.status || '').toLowerCase() !== statusFilter) {
        return false;
      }

      if (req.query.method && req.query.method !== 'all') {
        const m = req.query.method.toLowerCase();
        const pm = (rec.payment_method || '').toLowerCase();
        if (m === 'cash' && !(pm.includes('cash') || pm.includes('counter'))) return false;
        if (m === 'payu' && !pm.includes('payu')) return false;
        if (m === 'icici' && !pm.includes('icici')) return false;
        if (m === 'phonepe' && !pm.includes('phonepe')) return false;
        if (m === 'wallet' && !pm.includes('wallet')) return false;
      }

      if (effectiveZoneFilter && effectiveZoneFilter.toLowerCase() !== 'all' && effectiveZoneFilter.toLowerCase() !== 'all zones') {
        const allowedZones = effectiveZoneFilter.split(',').map(z => z.trim().toLowerCase()).filter(Boolean);
        if (allowedZones.length > 0) {
          const recZone = (rec.zone || 'Gotri Zone').toLowerCase().trim();
          const cleanRz = recZone.replace(/zone/i, '').trim();
          const matched = allowedZones.some(az => {
            const cleanAz = az.replace(/zone/i, '').trim();
            return recZone.includes(az) || az.includes(recZone) || (cleanAz && cleanRz && (cleanRz.includes(cleanAz) || cleanAz.includes(cleanRz)));
          });
          if (!matched) return false;
        }
      }

      if (fromDate) {
        const recDate = new Date(rec.created_at);
        const startDay = new Date(fromDate);
        startDay.setHours(0, 0, 0, 0);
        if (recDate < startDay) return false;
      }

      if (toDate) {
        const recDate = new Date(rec.created_at);
        const endDay = new Date(toDate);
        endDay.setHours(23, 59, 59, 999);
        if (recDate > endDay) return false;
      }

      return true;
    });

    if (format === 'json') {
      return res.json({ status: 'success', count: rows.length, data: rows });
    }

    // CSV format
    if (rows.length === 0) {
      return res.send('No transactions found');
    }

    const headers = ['Transaction ID', 'Reference ID', 'Rider Name', 'Mobile', 'Rent (INR)', 'Deposit (INR)', 'Total Amount (INR)', 'Type', 'Status', 'Payment Method', 'Purpose', 'Date Time'];
    const csvLines = [headers.join(',')];

    for (const r of rows) {
      const line = [
        `"${String(r.tx_id || '').replace(/"/g, '""')}"`,
        `"${String(r.reference_id || '').replace(/"/g, '""')}"`,
        `"${String(r.rider_name || '').replace(/"/g, '""')}"`,
        `"${String(r.mobile || '').replace(/"/g, '""')}"`,
        `"${Number(r.rent_amount || 0).toFixed(2)}"`,
        `"${Number(r.deposit_amount || 0).toFixed(2)}"`,
        `"${Number(r.amount || 0).toFixed(2)}"`,
        `"${String(r.type || '').replace(/"/g, '""')}"`,
        `"${String(r.status || '').replace(/"/g, '""')}"`,
        `"${String(r.payment_method || '').replace(/"/g, '""')}"`,
        `"${String(r.purpose || '').replace(/"/g, '""')}"`,
        `"${r.created_at ? new Date(r.created_at).toISOString() : ''}"`
      ];
      csvLines.push(line.join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="transactions_export_${Date.now()}.csv"`);
    return res.send(csvLines.join('\n'));
  } catch (err) {
    console.error('Error exporting transactions:', err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;

