"use client";
import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';

export interface JobCardPartItem {
  id: string;
  name: string;
  qty: number;
  unit_price: number;
  total: number;
  is_custom?: boolean;
}

const CATALOG_PARTS = [
  { name: 'Left Rear-View Mirror (OEM)', price: 350 },
  { name: 'Right Rear-View Mirror (OEM)', price: 350 },
  { name: 'Front Brake Lever & Cable Assembly', price: 450 },
  { name: 'Rear Brake Lever & Cable Assembly', price: 450 },
  { name: 'MRF Front Tubeless Tyre (90/90-12)', price: 1250 },
  { name: 'MRF Rear Tubeless Tyre (90/90-12)', price: 1350 },
  { name: 'LED Headlamp & DRL Assembly', price: 1400 },
  { name: 'LED Tail Lamp & Blinker Lens Unit', price: 750 },
  { name: 'Left Side Body Apron Panel', price: 850 },
  { name: 'Right Side Body Apron Panel', price: 850 },
  { name: 'Front Mudguard Fender Shield', price: 550 },
  { name: 'Rear Mudguard Shield', price: 450 },
  { name: 'Telescopic Front Fork Suspension', price: 1200 },
  { name: 'Heavy-Duty Brake Pads Set (Front/Rear)', price: 320 },
  { name: 'Side Stand & Cut-off Sensor', price: 280 },
  { name: 'Main Harness / BMS Battery Cable', price: 500 }
];

interface CreateJobCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateJobCardModal({ isOpen, onClose, onSuccess }: CreateJobCardModalProps) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [vehicleCode, setVehicleCode] = useState('EVM5025009');
  const [vehicleModel, setVehicleModel] = useState('Evegah City');
  const [vehicleCategory, setVehicleCategory] = useState('Electric Scooter');
  const [kmReading, setKmReading] = useState('4,500 km');

  const [isRiderDamage, setIsRiderDamage] = useState(true);
  const [riderName, setRiderName] = useState('GANAVA SANDIPBHAI RASULBHAI');
  const [riderMobile, setRiderMobile] = useState('+91 8238961974');
  const [reservationId, setReservationId] = useState('EVR-2C1CF7');
  const [faultType, setFaultType] = useState('Rider Damage');
  const [liability, setLiability] = useState('Rider Liable');
  const [riderChargeAmount, setRiderChargeAmount] = useState<number | ''>('');
  const [riderPaymentStatus, setRiderPaymentStatus] = useState('Deducted from Deposit');

  const [issueCategory, setIssueCategory] = useState('Body & Mirror Damage');
  const [priority, setPriority] = useState('High');
  const [description, setDescription] = useState('Left side body panel cracked and side-view mirror damaged upon vehicle return check-in.');
  const [assignedTechnician, setAssignedTechnician] = useState('Ramesh Patel');
  const [serviceCenter, setServiceCenter] = useState('Gotri Service Hub');
  const [zone, setZone] = useState('Gotri Zone');

  // Multi-parts & Custom Items state
  const [selectedCatalogPart, setSelectedCatalogPart] = useState(CATALOG_PARTS[0].name);
  const [catalogPartQty, setCatalogPartQty] = useState(1);

  // Custom Item inputs
  const [customItemName, setCustomItemName] = useState('');
  const [customItemQty, setCustomItemQty] = useState(1);
  const [customItemPrice, setCustomItemPrice] = useState<number | ''>('');

  const [itemsList, setItemsList] = useState<JobCardPartItem[]>([
    { id: 'item-1', name: 'Left Rear-View Mirror (OEM)', qty: 1, unit_price: 350, total: 350 },
    { id: 'item-2', name: 'Left Side Body Apron Panel', qty: 1, unit_price: 850, total: 850 }
  ]);

  const [laborCost, setLaborCost] = useState(400);

  // Auto calculate total parts cost
  const partsTotal = itemsList.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const totalCost = partsTotal + (Number(laborCost) || 0);

  // Auto-sync rider charge amount with total expense when total changes unless user customized it
  useEffect(() => {
    if (riderChargeAmount === '' || riderChargeAmount === 0 || !isRiderDamage) {
      setRiderChargeAmount(totalCost);
    }
  }, [totalCost, isRiderDamage]);

  // Fetch real vehicles and active riders from backend
  useEffect(() => {
    if (!isOpen) return;
    const loadData = async () => {
      try {
        const [vRes, rRes]: any = await Promise.all([
          api.get('/vehicles').catch(() => ({ data: [] })),
          api.get('/reservations').catch(() => ({ data: [] }))
        ]);
        const vList = Array.isArray(vRes) ? vRes : (vRes?.data || []);
        const rList = Array.isArray(rRes) ? rRes : (rRes?.data || []);

        if (vList.length > 0) setVehicles(vList);
        if (rList.length > 0) setRiders(rList);
      } catch (_) {}
    };
    loadData();
  }, [isOpen]);

  // Handle adding standard part from catalog
  const handleAddCatalogPart = () => {
    const found = CATALOG_PARTS.find(p => p.name === selectedCatalogPart);
    if (!found) return;

    const qty = Math.max(1, Number(catalogPartQty) || 1);
    const existingIndex = itemsList.findIndex(i => i.name === found.name);

    if (existingIndex !== -1) {
      // Increment existing item quantity
      setItemsList(prev => prev.map((item, idx) => {
        if (idx === existingIndex) {
          const newQty = item.qty + qty;
          return { ...item, qty: newQty, total: newQty * item.unit_price };
        }
        return item;
      }));
    } else {
      // Add new item
      const newItem: JobCardPartItem = {
        id: `part-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: found.name,
        qty: qty,
        unit_price: found.price,
        total: qty * found.price
      };
      setItemsList(prev => [...prev, newItem]);
    }
    setCatalogPartQty(1);
  };

  // Handle adding custom part / labor item
  const handleAddCustomItem = () => {
    if (!customItemName.trim()) {
      alert('Please enter a custom part or service name');
      return;
    }
    const price = Number(customItemPrice) || 0;
    if (price <= 0) {
      alert('Please enter a valid price for the custom part');
      return;
    }
    const qty = Math.max(1, Number(customItemQty) || 1);

    const newItem: JobCardPartItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: customItemName.trim(),
      qty: qty,
      unit_price: price,
      total: qty * price,
      is_custom: true
    };

    setItemsList(prev => [...prev, newItem]);
    setCustomItemName('');
    setCustomItemQty(1);
    setCustomItemPrice('');
  };

  // Delete an item from the list
  const handleDeleteItem = (itemId: string) => {
    setItemsList(prev => prev.filter(item => item.id !== itemId));
  };

  // Update item quantity directly in table
  const handleUpdateItemQty = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleDeleteItem(itemId);
      return;
    }
    setItemsList(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, qty: newQty, total: newQty * item.unit_price };
      }
      return item;
    }));
  };

  const handleVehicleSelect = (code: string) => {
    setVehicleCode(code);
    const found = vehicles.find((v: any) => {
      const vNum = v.registration_number || v.vehicle_number || v.code || v.id;
      return vNum === code;
    });
    if (found) {
      setVehicleModel(found.evegah_model_name || found.model || 'Evegah City');
      setZone(found.assigned_zone_name || found.zone || 'Gotri Zone');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const finalRiderCharge = isRiderDamage ? (Number(riderChargeAmount) || totalCost) : 0;
      await api.post('/maintenance', {
        vehicle_code: vehicleCode,
        vehicle_model: vehicleModel,
        vehicle_category: vehicleCategory,
        km_reading: kmReading,
        issue_category: issueCategory,
        description,
        assigned_technician: assignedTechnician,
        service_center: serviceCenter,
        zone,
        priority,
        status: 'In Progress',
        parts_cost: partsTotal,
        labor_cost: Number(laborCost) || 0,
        total_cost: totalCost,
        estimated_cost: totalCost,
        rider_name: isRiderDamage ? riderName : null,
        rider_mobile: isRiderDamage ? riderMobile : null,
        reservation_id: isRiderDamage ? reservationId : null,
        fault_type: isRiderDamage ? faultType : 'Normal Wear & Tear',
        liability: isRiderDamage ? liability : 'Company / Fleet',
        rider_charge_amount: finalRiderCharge,
        rider_payment_status: isRiderDamage ? riderPaymentStatus : 'N/A (Fleet Expense)',
        items: itemsList
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to create job card:', err);
      alert('Error creating job card: ' + (err.message || 'Server error'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="jc-overlay" onClick={onClose}>
      <style>{`
        .jc-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(5px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }
        .jc-modal {
          background: #ffffff;
          border-radius: 20px;
          width: 100%;
          max-width: 900px;
          max-height: 94vh;
          overflow-y: auto;
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.3);
          border: 1px solid #E2E8F0;
          display: flex;
          flex-direction: column;
        }
        .jc-header {
          padding: 20px 24px;
          border-bottom: 1px solid #EDEFF5;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(180deg, #FAFBFD 0%, #FFFFFF 100%);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .jc-title {
          font-size: 18px;
          font-weight: 800;
          color: #0F172A;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .jc-close {
          border: none;
          background: #F1F5F9;
          color: #64748B;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .jc-close:hover { background: #E2E8F0; color: #0F172A; }
        .jc-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 22px;
        }
        .jc-section-title {
          font-size: 13px;
          font-weight: 800;
          color: #2A195C;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .jc-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .jc-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        .jc-form-group { display: flex; flex-direction: column; gap: 6px; }
        .jc-label { font-size: 12px; font-weight: 700; color: #334155; }
        .jc-input, .jc-select, .jc-textarea {
          border: 1.5px solid #E2E8F0;
          border-radius: 10px;
          padding: 9px 12px;
          font-size: 13px;
          color: #0F172A;
          background: #FFFFFF;
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
        }
        .jc-input:focus, .jc-select:focus, .jc-textarea:focus {
          border-color: #2A195C;
          box-shadow: 0 0 0 3px rgba(42, 25, 92, 0.08);
        }
        .jc-toggle-box {
          background: #F8FAFC;
          border: 1.5px solid #E2E8F0;
          border-radius: 12px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
        }

        /* Items Builder Cards & Table */
        .jc-items-builder {
          background: #F8FAFC;
          border: 1.5px solid #E2E8F0;
          border-radius: 14px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .jc-items-subtabs {
          display: flex;
          gap: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #E2E8F0;
        }
        .jc-items-table {
          width: 100%;
          border-collapse: collapse;
          background: #ffffff;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid #E2E8F0;
          font-size: 12.5px;
        }
        .jc-items-table th {
          background: #F1F5F9;
          padding: 10px 12px;
          font-size: 11px;
          font-weight: 800;
          color: #475569;
          text-transform: uppercase;
          text-align: left;
        }
        .jc-items-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #F1F5F9;
          vertical-align: middle;
        }
        .jc-items-table tr:last-child td { border-bottom: none; }
        .jc-del-btn {
          background: #FEF2F2;
          border: 1px solid #FECACA;
          color: #EF4444;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .jc-del-btn:hover { background: #EF4444; color: #fff; }

        .jc-footer {
          padding: 16px 24px;
          border-top: 1px solid #EDEFF5;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          background: #FAFBFD;
          position: sticky;
          bottom: 0;
          z-index: 10;
        }
        .jc-btn-cancel {
          padding: 10px 18px;
          border: 1.5px solid #CBD5E1;
          border-radius: 10px;
          background: #FFFFFF;
          font-size: 13px;
          font-weight: 700;
          color: #475569;
          cursor: pointer;
        }
        .jc-btn-submit {
          padding: 10px 24px;
          border: none;
          border-radius: 10px;
          background: #2A195C;
          color: #FFFFFF;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition: background 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .jc-btn-submit:hover { background: #4338CA; }
        @media (max-width: 700px) {
          .jc-grid-2, .jc-grid-3 { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="jc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="jc-header">
          <h3 className="jc-title">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2A195C" strokeWidth="2.5">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
            Create Maintenance Job Card &amp; Damage Claim
          </h3>
          <button className="jc-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="jc-body">
            {/* ── 1. Vehicle Details ── */}
            <div>
              <div className="jc-section-title">
                <span>1. Vehicle Information</span>
              </div>
              <div className="jc-grid-3">
                <div className="jc-form-group">
                  <label className="jc-label">Vehicle Number *</label>
                  <select
                    className="jc-select"
                    value={vehicleCode}
                    onChange={(e) => handleVehicleSelect(e.target.value)}
                    required
                  >
                    <option value="EVM5025009">EVM5025009 (Evegah City • Gotri Zone)</option>
                    <option value="EVM1024012">EVM1024012 (Evegah City • Gotri Zone)</option>
                    <option value="EVM5025006">EVM5025006 (Evegah City • Gotri Zone)</option>
                    <option value="SFN602611">SFN602611 (Evegah City • Daman SF)</option>
                    <option value="EVM502614">EVM502614 (Evegah Mink • Gotri Zone)</option>
                    <option value="EVM1024018">EVM1024018 (Evegah Pro • Gotri Zone)</option>
                    {vehicles.map((v: any, i: number) => {
                      const code = v.registration_number || v.vehicle_number || v.code || `EVM50${i}01`;
                      if (['EVM5025009', 'EVM1024012', 'EVM5025006', 'SFN602611', 'EVM502614', 'EVM1024018'].includes(code)) return null;
                      return (
                        <option key={v.id || i} value={code}>
                          {code} ({v.evegah_model_name || v.model || 'Evegah EV'})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="jc-form-group">
                  <label className="jc-label">Vehicle Model</label>
                  <input
                    type="text"
                    className="jc-input"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    required
                  />
                </div>

                <div className="jc-form-group">
                  <label className="jc-label">Odometer / Current KM</label>
                  <input
                    type="text"
                    className="jc-input"
                    value={kmReading}
                    onChange={(e) => setKmReading(e.target.value)}
                    placeholder="e.g. 4,280 km"
                  />
                </div>
              </div>
            </div>

            {/* ── 2. Rider Responsibility & Liability ── */}
            <div>
              <div className="jc-toggle-box" onClick={() => setIsRiderDamage(!isRiderDamage)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="checkbox"
                    checked={isRiderDamage}
                    onChange={(e) => setIsRiderDamage(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#2A195C', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0F172A' }}>
                      Rider Damage Incident (Billable to Rider)
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B' }}>
                      Check if vehicle was damaged by the rider during rental period to track liability and recover expense.
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: isRiderDamage ? '#EF4444' : '#64748B' }}>
                  {isRiderDamage ? '⚠️ Rider Liable' : '🛡️ Fleet Expense'}
                </span>
              </div>

              {isRiderDamage && (
                <div style={{ marginTop: '14px', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '12px', padding: '16px' }}>
                  <div className="jc-grid-3">
                    <div className="jc-form-group">
                      <label className="jc-label" style={{ color: '#991B1B' }}>Rider Name *</label>
                      <input
                        type="text"
                        className="jc-input"
                        value={riderName}
                        onChange={(e) => setRiderName(e.target.value)}
                        placeholder="Rider full name"
                        required={isRiderDamage}
                      />
                    </div>

                    <div className="jc-form-group">
                      <label className="jc-label" style={{ color: '#991B1B' }}>Rider Mobile</label>
                      <input
                        type="text"
                        className="jc-input"
                        value={riderMobile}
                        onChange={(e) => setRiderMobile(e.target.value)}
                        placeholder="+91 9XXXXXXXXX"
                      />
                    </div>

                    <div className="jc-form-group">
                      <label className="jc-label" style={{ color: '#991B1B' }}>Ride / Reservation ID</label>
                      <input
                        type="text"
                        className="jc-input"
                        value={reservationId}
                        onChange={(e) => setReservationId(e.target.value)}
                        placeholder="e.g. EVR-2C1CF7"
                      />
                    </div>
                  </div>

                  <div className="jc-grid-3" style={{ marginTop: '12px' }}>
                    <div className="jc-form-group">
                      <label className="jc-label" style={{ color: '#991B1B' }}>Damage Liability</label>
                      <select
                        className="jc-select"
                        value={liability}
                        onChange={(e) => setLiability(e.target.value)}
                      >
                        <option value="Rider Liable">Rider Liable (100% Recovery)</option>
                        <option value="Shared 50-50">Shared 50-50</option>
                        <option value="Insurance Claim">Insurance Claim</option>
                        <option value="Company / Fleet">Company / Fleet Absorbed</option>
                      </select>
                    </div>

                    <div className="jc-form-group">
                      <label className="jc-label" style={{ color: '#991B1B' }}>Amount Billed to Rider (₹)</label>
                      <input
                        type="number"
                        className="jc-input"
                        value={riderChargeAmount}
                        onChange={(e) => setRiderChargeAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder={`Default: ₹${totalCost}`}
                      />
                    </div>

                    <div className="jc-form-group">
                      <label className="jc-label" style={{ color: '#991B1B' }}>Recovery Status</label>
                      <select
                        className="jc-select"
                        value={riderPaymentStatus}
                        onChange={(e) => setRiderPaymentStatus(e.target.value)}
                      >
                        <option value="Deducted from Deposit">Deducted from Deposit</option>
                        <option value="Paid via UPI">Paid via UPI / PayU</option>
                        <option value="Paid via Cash">Paid via Cash</option>
                        <option value="Pending Recovery">Pending Recovery</option>
                        <option value="Waived">Waived / Forgiven</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── 3. Spare Parts & Custom Items Builder ── */}
            <div>
              <div className="jc-section-title">
                <span>3. Spare Parts &amp; Repair Items Selection</span>
              </div>

              <div className="jc-items-builder">
                {/* Method 1: Choose from Catalog */}
                <div>
                  <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                    A. Select Standard Part from Catalog
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      className="jc-select"
                      style={{ flex: 2, minWidth: '220px' }}
                      value={selectedCatalogPart}
                      onChange={(e) => setSelectedCatalogPart(e.target.value)}
                    >
                      {CATALOG_PARTS.map((p) => (
                        <option key={p.name} value={p.name}>
                          {p.name} — ₹{p.price}
                        </option>
                      ))}
                    </select>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>Qty:</span>
                      <input
                        type="number"
                        min="1"
                        style={{ width: '60px' }}
                        className="jc-input"
                        value={catalogPartQty}
                        onChange={(e) => setCatalogPartQty(Number(e.target.value))}
                      />
                    </div>

                    <button
                      type="button"
                      className="jc-btn-submit"
                      style={{ padding: '8px 16px', fontSize: '12px', height: '38px', background: '#2A195C' }}
                      onClick={handleAddCatalogPart}
                    >
                      + Add Part
                    </button>
                  </div>
                </div>

                {/* Method 2: Add Custom Item */}
                <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                    B. Or Add Custom Item / Repair Service
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="jc-input"
                      style={{ flex: 2, minWidth: '200px' }}
                      placeholder="Custom Part / Labor Item Name (e.g. Fork Straightening)"
                      value={customItemName}
                      onChange={(e) => setCustomItemName(e.target.value)}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>Qty:</span>
                      <input
                        type="number"
                        min="1"
                        style={{ width: '60px' }}
                        className="jc-input"
                        value={customItemQty}
                        onChange={(e) => setCustomItemQty(Number(e.target.value))}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>₹:</span>
                      <input
                        type="number"
                        placeholder="Cost"
                        style={{ width: '90px' }}
                        className="jc-input"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      />
                    </div>

                    <button
                      type="button"
                      className="jc-btn-submit"
                      style={{ padding: '8px 16px', fontSize: '12px', height: '38px', background: '#059669' }}
                      onClick={handleAddCustomItem}
                    >
                      + Add Custom
                    </button>
                  </div>
                </div>

                {/* Added Items Table */}
                <div style={{ marginTop: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#0F172A', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Selected Items &amp; Parts ({itemsList.length})</span>
                    <span style={{ color: '#2A195C' }}>Parts Subtotal: ₹{partsTotal.toFixed(2)}</span>
                  </div>

                  {itemsList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', background: '#fff', borderRadius: '10px', border: '1px dashed #CBD5E1', color: '#94A3B8', fontSize: '12.5px' }}>
                      No parts added yet. Select a standard part above or add a custom item.
                    </div>
                  ) : (
                    <table className="jc-items-table">
                      <thead>
                        <tr>
                          <th>Item / Spare Part Name</th>
                          <th style={{ width: '80px', textAlign: 'center' }}>Qty</th>
                          <th style={{ width: '100px', textAlign: 'right' }}>Unit Price</th>
                          <th style={{ width: '100px', textAlign: 'right' }}>Total</th>
                          <th style={{ width: '50px', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsList.map((item) => (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 700, color: '#0F172A' }}>
                              {item.name}
                              {item.is_custom && (
                                <span style={{ marginLeft: '6px', fontSize: '10px', padding: '2px 6px', background: '#ECFDF5', color: '#059669', borderRadius: '4px', fontWeight: 800 }}>
                                  Custom
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="number"
                                min="1"
                                style={{ width: '50px', textAlign: 'center', padding: '4px', borderRadius: '6px', border: '1px solid #CBD5E1', fontWeight: 700 }}
                                value={item.qty}
                                onChange={(e) => handleUpdateItemQty(item.id, Number(e.target.value))}
                              />
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                              ₹{item.unit_price.toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: '#0F172A' }}>
                              ₹{item.total.toFixed(2)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="jc-del-btn"
                                onClick={() => handleDeleteItem(item.id)}
                                title="Delete item"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* ── 4. Service Scope & Details ── */}
            <div>
              <div className="jc-section-title">
                <span>4. Service Scope &amp; Workshop Details</span>
              </div>
              <div className="jc-grid-3">
                <div className="jc-form-group">
                  <label className="jc-label">Issue Category *</label>
                  <select
                    className="jc-select"
                    value={issueCategory}
                    onChange={(e) => setIssueCategory(e.target.value)}
                  >
                    <option value="Body & Mirror Damage">Body &amp; Mirror Damage</option>
                    <option value="Brake Lever & Indicator">Brake Lever &amp; Indicator</option>
                    <option value="Headlamp & Visor Impact">Headlamp &amp; Visor Impact</option>
                    <option value="Mudguard & Tail Lamp">Mudguard &amp; Tail Lamp</option>
                    <option value="Tyre Tread & Puncture Repair">Tyre Tread &amp; Puncture Repair</option>
                    <option value="10,000 km Periodic Service">10,000 km Periodic Service</option>
                    <option value="Battery Check & BMS">Battery Check &amp; BMS</option>
                    <option value="Motor & Wiring Controller">Motor &amp; Wiring Controller</option>
                  </select>
                </div>

                <div className="jc-form-group">
                  <label className="jc-label">Priority</label>
                  <select
                    className="jc-select"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    <option value="Critical / Urgent">Critical / Urgent</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div className="jc-form-group">
                  <label className="jc-label">Assigned Technician</label>
                  <select
                    className="jc-select"
                    value={assignedTechnician}
                    onChange={(e) => setAssignedTechnician(e.target.value)}
                  >
                    <option value="Ramesh Patel">Ramesh Patel (Master EV Mechanic)</option>
                    <option value="Suresh Yadav">Suresh Yadav (Electrical &amp; BMS)</option>
                    <option value="Krunal Parmar">Krunal Parmar (Body &amp; Chassis)</option>
                  </select>
                </div>
              </div>

              <div className="jc-form-group" style={{ marginTop: '14px' }}>
                <label className="jc-label">Damage Description &amp; Technical Notes *</label>
                <textarea
                  className="jc-textarea"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detailed inspection findings, damaged components, repair instructions..."
                  required
                />
              </div>
            </div>

            {/* ── 5. Financial Summary ── */}
            <div>
              <div className="jc-section-title">
                <span>5. Financial Summary</span>
              </div>
              <div className="jc-grid-3">
                <div className="jc-form-group">
                  <label className="jc-label">Parts Subtotal (Auto)</label>
                  <div style={{ padding: '9px 12px', background: '#F8FAFC', borderRadius: '10px', border: '1.5px solid #E2E8F0', fontWeight: 800, fontSize: '14px', color: '#0F172A' }}>
                    ₹{partsTotal.toFixed(2)}
                  </div>
                </div>

                <div className="jc-form-group">
                  <label className="jc-label">Labor &amp; Service Fee (₹)</label>
                  <input
                    type="number"
                    className="jc-input"
                    value={laborCost}
                    onChange={(e) => setLaborCost(Number(e.target.value))}
                  />
                </div>

                <div className="jc-form-group">
                  <label className="jc-label">Total Expense (₹)</label>
                  <div style={{ padding: '9px 12px', background: '#F5F3FF', borderRadius: '10px', border: '1.5px solid #DDD6FE', fontWeight: 900, fontSize: '16px', color: '#2A195C' }}>
                    ₹{totalCost.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="jc-footer">
            <button type="button" className="jc-btn-cancel" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="jc-btn-submit" disabled={submitting}>
              {submitting ? 'Creating Job Card...' : '✓ Generate Job Card & Log Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
