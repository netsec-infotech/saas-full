"use client";
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';
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

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Outfit:wght@600;700;800;900&display=swap');

/* Web Dashboard View */
.jc-page {
  display: flex;
  min-height: 100vh;
  background: #F6F7FC;
  font-family: 'Plus Jakarta Sans', sans-serif;
  color: #0F172A;
}
.jc-main {
  margin-left: 230px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  width: calc(100% - 230px);
  min-width: 0;
}
.jc-body {
  flex: 1;
  padding: 20px 26px 64px;
  max-width: 1560px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Breadcrumb */
.jc-bc {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: #64748B;
  font-weight: 500;
}
.jc-bc-link { color: #64748B; text-decoration: none; font-weight: 600; cursor: pointer; }
.jc-bc-link:hover { color: #2A195C; }
.jc-bc-sep { color: #CBD5E1; }
.jc-bc-cur { color: #2A195C; font-weight: 800; }

/* Header Row */
.jc-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.jc-h1-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.jc-h1 {
  font-size: 22px;
  font-weight: 900;
  color: #0F172A;
  margin: 0;
  letter-spacing: -0.02em;
  font-family: 'Outfit', sans-serif;
}

.jc-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.jc-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.jc-btn-outline {
  background: #FFF;
  border: 1.5px solid #E2E8F0;
  color: #334155;
}
.jc-btn-outline:hover { border-color: #2A195C; color: #2A195C; background: #FAF9FF; }
.jc-btn-primary {
  background: #2A195C;
  border: 1.5px solid #2A195C;
  color: #FFF;
}
.jc-btn-primary:hover { background: #4338CA; border-color: #4338CA; }
.jc-btn-success {
  background: #059669;
  border: 1.5px solid #059669;
  color: #FFF;
}
.jc-btn-success:hover { background: #047857; }

/* Top Vehicle Banner */
.jc-banner {
  background: #FFFFFF;
  border: 1.5px solid #EAECF4;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
  flex-wrap: wrap;
}
.jc-banner-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.jc-scooter-img {
  width: 72px;
  height: 72px;
  object-fit: contain;
  background: #F8FAFC;
  border-radius: 12px;
  padding: 6px;
  border: 1px solid #EAECF4;
}
.jc-banner-veh-id {
  font-size: 18px;
  font-weight: 900;
  color: #0F172A;
  display: flex;
  align-items: center;
  gap: 8px;
}
.jc-banner-veh-sub {
  font-size: 13px;
  color: #64748B;
  font-weight: 600;
  margin-top: 2px;
}

.jc-banner-grid {
  display: grid;
  grid-template-columns: repeat(4, auto);
  gap: 20px;
}
.jc-banner-info-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.jc-banner-info-label {
  font-size: 10px;
  color: #64748B;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.jc-banner-info-val {
  font-size: 13.5px;
  font-weight: 800;
  color: #0F172A;
}

/* 2-Column Responsive Layout */
.jc-layout-grid {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 20px;
  align-items: start;
}

.jc-card {
  background: #FFFFFF;
  border: 1.5px solid #EAECF4;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
  margin-bottom: 20px;
}
.jc-card-title {
  font-size: 15px;
  font-weight: 800;
  color: #0F172A;
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Badges */
.pill-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 8px;
  font-size: 11.5px;
  font-weight: 800;
}
.pill-red { background: #FEF2F2; color: #EF4444; border: 1px solid #FECACA; }
.pill-green { background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; }
.pill-amber { background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A; }
.pill-blue { background: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; }
.pill-gray { background: #F1F5F9; color: #64748B; border: 1px solid #E2E8F0; }

/* Financial breakdown rows */
.jc-cost-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #F1F5F9;
  font-size: 13px;
}
.jc-cost-row:last-child { border-bottom: none; }
.jc-cost-total {
  font-size: 16px;
  font-weight: 900;
  color: #2A195C;
  border-top: 1.5px solid #EAECF4;
  padding-top: 14px;
  margin-top: 8px;
}

/* Items Table */
.items-tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.items-tbl th {
  background: #F8FAFC;
  padding: 9px 12px;
  text-align: left;
  font-size: 11px;
  font-weight: 800;
  color: #475569;
  border-bottom: 1px solid #E2E8F0;
  text-transform: uppercase;
}
.items-tbl td {
  padding: 10px 12px;
  border-bottom: 1px solid #F1F5F9;
  vertical-align: middle;
}
.items-tbl tr:last-child td {
  border-bottom: none;
}

@media (max-width: 1080px) {
  .jc-layout-grid { grid-template-columns: 1fr; }
  .jc-banner-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
}

@media (max-width: 860px) {
  .jc-page { flex-direction: column; }
  .jc-main { margin-left: 0; width: 100%; }
  .jc-body { padding: 16px; }
  .jc-banner { flex-direction: column; align-items: flex-start; }
}

/* ================= PRINT-ONLY STYLING ================= */
.print-job-card-sheet {
  display: none;
}

@media print {
  @page {
    size: A4 portrait;
    margin: 10mm 12mm;
  }
  
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #FFFFFF !important;
    color: #0F172A !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* Completely hide web shell UI */
  .jc-page,
  .jc-main,
  .sidebar,
  .topbar,
  header,
  nav,
  button,
  .no-print {
    display: none !important;
  }

  /* Display dedicated printable document */
  .print-job-card-sheet {
    display: block !important;
    width: 100% !important;
    box-sizing: border-box !important;
    background: #FFFFFF !important;
    color: #0F172A !important;
    font-family: 'Plus Jakarta Sans', Arial, sans-serif !important;
  }
}
`;

export default function JobCardDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string) || '';

  const [jobCard, setJobCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Multi-items state for viewing & editing
  const [itemsList, setItemsList] = useState<JobCardPartItem[]>([]);
  const [laborCost, setLaborCost] = useState<number>(300);

  // Catalog picker
  const [selectedCatalogPart, setSelectedCatalogPart] = useState(CATALOG_PARTS[0].name);
  const [catalogPartQty, setCatalogPartQty] = useState(1);

  // Custom Item inputs
  const [customItemName, setCustomItemName] = useState('');
  const [customItemQty, setCustomItemQty] = useState(1);
  const [customItemPrice, setCustomItemPrice] = useState<number | ''>('');

  const fetchJobCard = async () => {
    setLoading(true);
    try {
      const res: any = await api.get(`/maintenance/${id}`);
      const data = res?.data || res;
      setJobCard(data);

      // Parse items
      let itms: JobCardPartItem[] = [];
      if (Array.isArray(data.items) && data.items.length > 0) {
        itms = data.items;
      } else if (typeof data.items === 'string') {
        try {
          const parsed = JSON.parse(data.items);
          if (Array.isArray(parsed)) itms = parsed;
        } catch (e) {}
      }

      // Default fallback items if none exist in record
      if (itms.length === 0) {
        itms = [
          {
            id: 'item-1',
            name: data.issue_category?.includes('Mirror') ? 'Left Rear-View Mirror (OEM)' : 'Front Mudguard Fender Shield',
            qty: 1,
            unit_price: Number(data.parts_cost || 450),
            total: Number(data.parts_cost || 450),
          }
        ];
      }

      setItemsList(itms);
      setLaborCost(Number(data.labor_cost || 300));
    } catch (e) {
      console.error('Failed to load job card:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchJobCard();
  }, [id]);

  // Add from catalog
  const handleAddCatalogPart = () => {
    const partDef = CATALOG_PARTS.find(p => p.name === selectedCatalogPart);
    if (!partDef) return;

    const existingIdx = itemsList.findIndex(i => i.name === partDef.name);
    if (existingIdx >= 0) {
      const updated = [...itemsList];
      updated[existingIdx].qty += catalogPartQty;
      updated[existingIdx].total = updated[existingIdx].qty * updated[existingIdx].unit_price;
      setItemsList(updated);
    } else {
      const newItem: JobCardPartItem = {
        id: `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: partDef.name,
        qty: catalogPartQty,
        unit_price: partDef.price,
        total: catalogPartQty * partDef.price,
        is_custom: false,
      };
      setItemsList(prev => [...prev, newItem]);
    }
    setCatalogPartQty(1);
  };

  // Add custom item
  const handleAddCustomItem = () => {
    if (!customItemName.trim()) {
      alert('Please enter a description/name for the custom part.');
      return;
    }
    const price = Number(customItemPrice) || 0;
    if (price <= 0) {
      alert('Please enter a valid unit price.');
      return;
    }

    const newItem: JobCardPartItem = {
      id: `cst-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: customItemName.trim(),
      qty: customItemQty,
      unit_price: price,
      total: customItemQty * price,
      is_custom: true,
    };
    setItemsList(prev => [...prev, newItem]);
    setCustomItemName('');
    setCustomItemPrice('');
    setCustomItemQty(1);
  };

  // Delete item
  const handleDeleteItem = (itemId: string) => {
    setItemsList(prev => prev.filter(i => i.id !== itemId));
  };

  // Change quantity
  const handleQtyChange = (itemId: string, newQty: number) => {
    if (newQty < 1) return;
    setItemsList(prev =>
      prev.map(item => {
        if (item.id === itemId) {
          return { ...item, qty: newQty, total: newQty * item.unit_price };
        }
        return item;
      })
    );
  };

  // Calculations
  const isRiderDamage = (jobCard?.fault_type || '').includes('Rider') || !!jobCard?.rider_name;
  const partsExp = itemsList.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const totalExp = partsExp + Number(laborCost || 0);
  const riderCharge = isRiderDamage ? totalExp : 0;

  // Save changes to database
  const handleSaveItemsToDb = async () => {
    setUpdating(true);
    try {
      await api.put(`/maintenance/${id}`, {
        items: itemsList,
        parts_cost: partsExp,
        labor_cost: laborCost,
        total_cost: totalExp,
        rider_charge_amount: riderCharge,
      });
      setJobCard((prev: any) => ({
        ...prev,
        items: itemsList,
        parts_cost: partsExp,
        labor_cost: laborCost,
        total_cost: totalExp,
        rider_charge_amount: riderCharge,
      }));
      setSaveSuccessMsg(true);
      setTimeout(() => setSaveSuccessMsg(false), 3000);
    } catch (e) {
      alert('Failed to save parts changes to database.');
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    try {
      await api.put(`/maintenance/${id}`, { status: newStatus });
      setJobCard((prev: any) => ({ ...prev, status: newStatus }));
      alert(`Job card marked as ${newStatus}!`);
    } catch (e) {
      alert('Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handlePaymentStatusChange = async (newPayStatus: string) => {
    setUpdating(true);
    try {
      await api.put(`/maintenance/${id}`, { rider_payment_status: newPayStatus });
      setJobCard((prev: any) => ({ ...prev, rider_payment_status: newPayStatus }));
      alert(`Payment / Recovery status updated to ${newPayStatus}!`);
    } catch (e) {
      alert('Failed to update payment status');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="jc-page">
        <Sidebar activePath="/maintenance/overview" />
        <div className="jc-main">
          <TopBar showHand={false} />
          <div style={{ textAlign: 'center', padding: '100px', color: '#64748B', fontWeight: 600 }}>
            Loading Job Card #{id} from database...
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* ================= WEB APP SCREEN VIEW ================= */}
      <div className="jc-page">
        <Sidebar activePath="/maintenance/overview" />

        <div className="jc-main">
          <TopBar showHand={false} />

          <div className="jc-body">
            {/* Breadcrumb */}
            <div className="jc-bc">
              <span className="jc-bc-link" onClick={() => router.push('/maintenance/overview')}>Maintenance</span>
              <span className="jc-bc-sep">&gt;</span>
              <span className="jc-bc-link" onClick={() => router.push('/maintenance/overview')}>Job Cards</span>
              <span className="jc-bc-sep">&gt;</span>
              <span className="jc-bc-cur">{jobCard?.job_card_number || jobCard?.ticket_id || id}</span>
            </div>

            {/* Header */}
            <div className="jc-header-row">
              <div className="jc-h1-row">
                <h1 className="jc-h1">Job Card #{jobCard?.job_card_number || jobCard?.ticket_id || id}</h1>
                <span className={`pill-badge ${
                  jobCard?.status === 'Completed' ? 'pill-green' : 'pill-blue'
                }`}>
                  ● {jobCard?.status || 'Scheduled'}
                </span>
                {isRiderDamage && (
                  <span className="pill-badge pill-red">
                    ⚠️ Rider Damage Liability
                  </span>
                )}
              </div>
              <div className="jc-actions">
                <button className="jc-btn jc-btn-outline" onClick={() => router.push('/maintenance/overview')}>
                  ← Back to Overview
                </button>
                <button className="jc-btn jc-btn-outline" onClick={() => window.print()}>
                  🖨️ Print Job Card
                </button>
                {jobCard?.status !== 'Completed' && (
                  <button
                    className="jc-btn jc-btn-primary"
                    onClick={() => handleStatusChange('Completed')}
                    disabled={updating}
                  >
                    ✓ Mark Work Completed
                  </button>
                )}
              </div>
            </div>

            {/* Top Vehicle Banner */}
            <div className="jc-banner">
              <div className="jc-banner-left">
                <img
                  src={
                    jobCard?.vehicle_model?.toLowerCase().includes('mink')
                      ? '/assets/mink.png'
                      : jobCard?.vehicle_model?.toLowerCase().includes('pro')
                      ? '/assets/Pro_Banner.png'
                      : '/assets/city.png'
                  }
                  className="jc-scooter-img"
                  alt="Vehicle"
                />
                <div>
                  <div className="jc-banner-veh-id">
                    <span>{jobCard?.vehicle_code || 'EVM5025009'}</span>
                    <span className="pill-badge pill-green">Assigned Unit</span>
                  </div>
                  <div className="jc-banner-veh-sub">
                    {jobCard?.vehicle_model || 'Evegah City'} • {jobCard?.vehicle_category || 'Electric Scooter'}
                  </div>
                </div>
              </div>

              <div className="jc-banner-grid">
                <div className="jc-banner-info-box">
                  <span className="jc-banner-info-label">Odometer Reading</span>
                  <span className="jc-banner-info-val">{jobCard?.km_reading || '4,280 km'}</span>
                </div>
                <div className="jc-banner-info-box">
                  <span className="jc-banner-info-label">Zone Hub</span>
                  <span className="jc-banner-info-val">{jobCard?.zone || 'Gotri Zone'}</span>
                </div>
                <div className="jc-banner-info-box">
                  <span className="jc-banner-info-label">Assigned Technician</span>
                  <span className="jc-banner-info-val">{jobCard?.assigned_technician || 'Ramesh Patel'}</span>
                </div>
                <div className="jc-banner-info-box">
                  <span className="jc-banner-info-label">Service Workshop</span>
                  <span className="jc-banner-info-val">{jobCard?.service_center || 'Gotri Service Hub'}</span>
                </div>
              </div>
            </div>

            {/* 2-Column Details Layout */}
            <div className="jc-layout-grid">
              {/* Left Column: Scope, Parts Catalog & Custom Items Table */}
              <div>
                {/* Rider Damage Claim Box (if rider involved) */}
                {isRiderDamage && (
                  <div className="jc-card" style={{ borderColor: '#FECACA', background: '#FFFDFD' }}>
                    <div className="jc-card-title">
                      <span style={{ color: '#991B1B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Rider Damage Incident &amp; Recovery Details
                      </span>
                      <span className="pill-badge pill-red">Billable to Rider</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Responsible Rider</div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                          {jobCard.rider_name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>{jobCard.rider_mobile || '+91 8238961974'}</div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Ride Reservation ID</div>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#2A195C', marginTop: '2px', fontFamily: 'monospace' }}>
                          {jobCard.reservation_id || 'EVR-2C1CF7'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', borderTop: '1px solid #FEE2E2', paddingTop: '14px' }}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Damage Amount Charged</div>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: '#991B1B', marginTop: '2px' }}>
                          ₹{riderCharge.toFixed(2)}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Recovery Status</div>
                        <select
                          style={{ padding: '6px 10px', borderRadius: '8px', border: '1.5px solid #E2E8F0', fontSize: '12.5px', fontWeight: 700, color: '#0F172A', outline: 'none' }}
                          value={jobCard.rider_payment_status || 'Pending Recovery'}
                          onChange={(e) => handlePaymentStatusChange(e.target.value)}
                          disabled={updating}
                        >
                          <option value="Deducted from Deposit">Deducted from Deposit</option>
                          <option value="Paid via UPI">Paid via UPI</option>
                          <option value="Paid via Cash">Paid via Cash</option>
                          <option value="Pending Recovery">Pending Recovery</option>
                          <option value="Waived">Waived</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Technical Inspection & Findings */}
                <div className="jc-card">
                  <div className="jc-card-title">
                    <span>Inspection Findings &amp; Damage Remarks</span>
                  </div>

                  <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '10px', border: '1px solid #EAECF4', fontSize: '13.5px', lineHeight: 1.6, color: '#1E293B', fontWeight: 500 }}>
                    {jobCard?.description || 'Routine service inspection and maintenance procedure.'}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Service Category</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                        {jobCard?.issue_category || 'General Service'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Priority Level</div>
                      <div style={{ fontSize: '13.5px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                        {jobCard?.priority || 'Medium'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Multi-Item Spare Parts & Custom Items Management */}
                <div className="jc-card">
                  <div className="jc-card-title">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2A195C" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                      <span>Replaced Parts &amp; Service Items ({itemsList.length})</span>
                    </div>
                    {saveSuccessMsg && (
                      <span style={{ fontSize: '12px', color: '#059669', fontWeight: 800 }}>
                        ✓ Changes Saved!
                      </span>
                    )}
                  </div>

                  {/* Add Part from Catalog */}
                  <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '12px', border: '1px solid #EAECF4', marginBottom: '14px' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#475569', marginBottom: '8px', textTransform: 'uppercase' }}>
                      Select Part from Evegah Catalog
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <select
                        style={{ flex: 1, minWidth: '220px', height: '36px', padding: '0 10px', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '12.5px', fontWeight: 600 }}
                        value={selectedCatalogPart}
                        onChange={(e) => setSelectedCatalogPart(e.target.value)}
                      >
                        {CATALOG_PARTS.map((p, idx) => (
                          <option key={idx} value={p.name}>
                            {p.name} — ₹{p.price}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        style={{ width: '60px', height: '36px', textAlign: 'center', borderRadius: '8px', border: '1.5px solid #CBD5E1', fontSize: '12.5px', fontWeight: 700 }}
                        value={catalogPartQty}
                        onChange={(e) => setCatalogPartQty(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                      <button
                        type="button"
                        className="jc-btn jc-btn-primary"
                        style={{ padding: '0 14px', height: '36px', fontSize: '12.5px' }}
                        onClick={handleAddCatalogPart}
                      >
                        + Add Part
                      </button>
                    </div>
                  </div>

                  {/* Add Custom Part or Outside Vendor Item */}
                  <div style={{ background: '#FAF5FF', padding: '14px', borderRadius: '12px', border: '1px solid #DDD6FE', marginBottom: '16px' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#6D28D9', marginBottom: '8px', textTransform: 'uppercase' }}>
                      + Add Custom Part / Outside Service Item
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px auto', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Custom Part Name or Service Description..."
                        style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1.5px solid #DDD6FE', fontSize: '12.5px' }}
                        value={customItemName}
                        onChange={(e) => setCustomItemName(e.target.value)}
                      />
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        style={{ height: '36px', textAlign: 'center', borderRadius: '8px', border: '1.5px solid #DDD6FE', fontSize: '12.5px', fontWeight: 700 }}
                        value={customItemQty}
                        onChange={(e) => setCustomItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                      <input
                        type="number"
                        placeholder="Price ₹"
                        style={{ height: '36px', padding: '0 10px', borderRadius: '8px', border: '1.5px solid #DDD6FE', fontSize: '12.5px', fontWeight: 700 }}
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(e.target.value === '' ? '' : Number(e.target.value))}
                      />
                      <button
                        type="button"
                        className="jc-btn jc-btn-primary"
                        style={{ background: '#7C3AED', borderColor: '#7C3AED', padding: '0 14px', height: '36px', fontSize: '12px' }}
                        onClick={handleAddCustomItem}
                      >
                        + Add Custom
                      </button>
                    </div>
                  </div>

                  {/* Items List Table */}
                  <div style={{ border: '1.5px solid #EAECF4', borderRadius: '12px', overflow: 'hidden' }}>
                    <table className="items-tbl">
                      <thead>
                        <tr>
                          <th>Item Description</th>
                          <th style={{ width: '80px', textAlign: 'center' }}>Qty</th>
                          <th style={{ width: '100px', textAlign: 'right' }}>Unit Price</th>
                          <th style={{ width: '100px', textAlign: 'right' }}>Total</th>
                          <th style={{ width: '40px', textAlign: 'center' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsList.length === 0 ? (
                          <tr>
                            <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: '#94A3B8' }}>
                              No parts added to this job card yet. Select from catalog or add custom item.
                            </td>
                          </tr>
                        ) : (
                          itemsList.map((item) => (
                            <tr key={item.id}>
                              <td>
                                <div style={{ fontWeight: 700, color: '#0F172A' }}>{item.name}</div>
                                {item.is_custom && (
                                  <span style={{ fontSize: '10px', background: '#F5F3FF', color: '#7C3AED', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                    Custom Part
                                  </span>
                                )}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleQtyChange(item.id, item.qty - 1)}
                                    style={{ width: '20px', height: '20px', border: '1px solid #CBD5E1', borderRadius: '4px', background: '#FFF', cursor: 'pointer', fontSize: '11px' }}
                                  >
                                    -
                                  </button>
                                  <span style={{ fontWeight: 800, minWidth: '18px', textAlign: 'center' }}>{item.qty}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleQtyChange(item.id, item.qty + 1)}
                                    style={{ width: '20px', height: '20px', border: '1px solid #CBD5E1', borderRadius: '4px', background: '#FFF', cursor: 'pointer', fontSize: '11px' }}
                                  >
                                    +
                                  </button>
                                </div>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{item.unit_price}</td>
                              <td style={{ textAlign: 'right', fontWeight: 800, color: '#0F172A' }}>₹{item.total}</td>
                              <td style={{ textAlign: 'center' }}>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item.id)}
                                  title="Delete item"
                                  style={{ border: 'none', background: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '14px', fontWeight: 800 }}
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                    <button
                      type="button"
                      className="jc-btn jc-btn-success"
                      onClick={handleSaveItemsToDb}
                      disabled={updating}
                    >
                      💾 Save Parts &amp; Cost Changes
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Invoice & Financial Summary */}
              <div>
                <div className="jc-card">
                  <div className="jc-card-title">
                    <span>Financial Breakdown</span>
                  </div>

                  <div className="jc-cost-row">
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Spare Parts Total ({itemsList.length} items):</span>
                    <span style={{ fontWeight: 800, color: '#0F172A' }}>₹{partsExp.toFixed(2)}</span>
                  </div>

                  <div className="jc-cost-row">
                    <span style={{ color: '#64748B', fontWeight: 600 }}>Labor &amp; Service Fee:</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontWeight: 800, color: '#0F172A' }}>₹</span>
                      <input
                        type="number"
                        min="0"
                        style={{ width: '70px', padding: '4px 6px', borderRadius: '6px', border: '1px solid #CBD5E1', textAlign: 'right', fontWeight: 800 }}
                        value={laborCost}
                        onChange={(e) => setLaborCost(Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  <div className="jc-cost-row jc-cost-total">
                    <span>Total Repair Expense:</span>
                    <span>₹{totalExp.toFixed(2)}</span>
                  </div>

                  <div style={{ marginTop: '16px', background: '#F8FAFC', padding: '12px', borderRadius: '10px', border: '1px solid #EAECF4' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>Billed Entity</div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>
                      {isRiderDamage ? `Rider: ${jobCard.rider_name}` : 'Company / Fleet Expense'}
                    </div>
                    <div style={{ fontSize: '11.5px', color: isRiderDamage ? '#059669' : '#64748B', fontWeight: 700, marginTop: '2px' }}>
                      {isRiderDamage ? `Status: ${jobCard.rider_payment_status || 'Pending Recovery'}` : 'Absorbed in monthly operational budget'}
                    </div>
                  </div>

                  <div style={{ marginTop: '14px' }}>
                    <button
                      type="button"
                      className="jc-btn jc-btn-outline"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => window.print()}
                    >
                      🖨️ Print Evegah Job Card
                    </button>
                  </div>
                </div>

                {/* Workshop Quick Controls */}
                <div className="jc-card">
                  <div className="jc-card-title">
                    <span>Update Work Status</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      className="jc-btn jc-btn-outline"
                      style={{ justifyContent: 'center' }}
                      onClick={() => handleStatusChange('In Progress')}
                      disabled={updating}
                    >
                      ⚙️ Mark In Progress
                    </button>
                    <button
                      className="jc-btn jc-btn-outline"
                      style={{ justifyContent: 'center' }}
                      onClick={() => handleStatusChange('Under Maintenance')}
                      disabled={updating}
                    >
                      🛑 Waiting for Parts / Hold
                    </button>
                    <button
                      className="jc-btn jc-btn-primary"
                      style={{ justifyContent: 'center' }}
                      onClick={() => handleStatusChange('Completed')}
                      disabled={updating}
                    >
                      ✓ Work Finished &amp; Vehicle Released
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= PRINT-ONLY DEDICATED EVEGAH JOB CARD ================= */}
      <div className="print-job-card-sheet">
        {/* Brand Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2.5px solid #2A195C', paddingBottom: '12px', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#2A195C', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>EVEGAH FLEET SERVICES</span>
            </div>
            <div style={{ fontSize: '11px', color: '#475569', fontWeight: 600, marginTop: '2px' }}>
              Evegah Mobility Pvt. Ltd. • Registered Workshop &amp; Fleet Operations Hub
            </div>
            <div style={{ fontSize: '10px', color: '#64748B', marginTop: '1px' }}>
              Reg. Office: Gotri Sevasi Road, Vadodara, Gujarat 390021 • GSTIN: 24AAECE1234F1Z5 • Support: +91 8238961974
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '16px', fontWeight: 900, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              WORKSHOP JOB CARD
            </div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#2A195C', fontFamily: 'monospace', marginTop: '2px' }}>
              #{jobCard?.job_card_number || jobCard?.ticket_id || id}
            </div>
            <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
              Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* 2-Column Info Grid: Vehicle Info & Rider Liability */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
          {/* Vehicle Info */}
          <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#2A195C', textTransform: 'uppercase', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px', marginBottom: '8px' }}>
              1. Vehicle &amp; Workshop Details
            </div>
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ color: '#64748B', padding: '3px 0', width: '40%' }}>Vehicle Code:</td>
                  <td style={{ fontWeight: 800, color: '#0F172A' }}>{jobCard?.vehicle_code || 'EVM5025009'}</td>
                </tr>
                <tr>
                  <td style={{ color: '#64748B', padding: '3px 0' }}>Model:</td>
                  <td style={{ fontWeight: 700 }}>{jobCard?.vehicle_model || 'Evegah City'}</td>
                </tr>
                <tr>
                  <td style={{ color: '#64748B', padding: '3px 0' }}>Odometer KM:</td>
                  <td style={{ fontWeight: 700 }}>{jobCard?.km_reading || '4,280 km'}</td>
                </tr>
                <tr>
                  <td style={{ color: '#64748B', padding: '3px 0' }}>Zone / Workshop:</td>
                  <td style={{ fontWeight: 700 }}>{jobCard?.zone || 'Gotri Hub'} • {jobCard?.service_center || 'Service Hub'}</td>
                </tr>
                <tr>
                  <td style={{ color: '#64748B', padding: '3px 0' }}>Lead Technician:</td>
                  <td style={{ fontWeight: 700 }}>{jobCard?.assigned_technician || 'Ramesh Patel'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Rider / Liability Info */}
          <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#2A195C', textTransform: 'uppercase', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px', marginBottom: '8px' }}>
              2. Rider &amp; Responsibility Assessment
            </div>
            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ color: '#64748B', padding: '3px 0', width: '40%' }}>Liability Classification:</td>
                  <td style={{ fontWeight: 800, color: isRiderDamage ? '#DC2626' : '#2563EB' }}>
                    {isRiderDamage ? '⚠️ Rider Liable Damage' : '🛡️ Fleet Normal Wear & Tear'}
                  </td>
                </tr>
                <tr>
                  <td style={{ color: '#64748B', padding: '3px 0' }}>Rider Name:</td>
                  <td style={{ fontWeight: 800 }}>{jobCard?.rider_name || 'N/A (Fleet Scheduled Service)'}</td>
                </tr>
                <tr>
                  <td style={{ color: '#64748B', padding: '3px 0' }}>Contact Number:</td>
                  <td style={{ fontWeight: 700 }}>{jobCard?.rider_mobile || 'N/A'}</td>
                </tr>
                <tr>
                  <td style={{ color: '#64748B', padding: '3px 0' }}>Reservation ID:</td>
                  <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{jobCard?.reservation_id || 'N/A'}</td>
                </tr>
                <tr>
                  <td style={{ color: '#64748B', padding: '3px 0' }}>Recovery Status:</td>
                  <td style={{ fontWeight: 800, color: '#059669' }}>
                    {isRiderDamage ? (jobCard?.rider_payment_status || 'Pending Recovery') : 'Company Absorbed'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Damage Findings & Remarks */}
        <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#2A195C', textTransform: 'uppercase', marginBottom: '4px' }}>
            3. Damage Inspection Remarks &amp; Service Scope
          </div>
          <div style={{ fontSize: '11px', color: '#1E293B', lineHeight: 1.5 }}>
            <span style={{ fontWeight: 700 }}>Category:</span> {jobCard?.issue_category || 'General Service'} | <span style={{ fontWeight: 700 }}>Priority:</span> {jobCard?.priority || 'Medium'}
            <br />
            <span style={{ fontWeight: 700 }}>Technical Observations:</span> {jobCard?.description || 'Routine service inspection and maintenance procedure.'}
          </div>
        </div>

        {/* Itemized Parts & Spares Table */}
        <div style={{ border: '1px solid #CBD5E1', borderRadius: '8px', overflow: 'hidden', marginBottom: '14px' }}>
          <div style={{ background: '#F8FAFC', padding: '8px 12px', fontSize: '11px', fontWeight: 800, color: '#2A195C', textTransform: 'uppercase', borderBottom: '1px solid #CBD5E1' }}>
            4. Replaced Spare Parts &amp; Service Components
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <thead>
              <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #CBD5E1' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', width: '30px' }}>#</th>
                <th style={{ padding: '6px 10px', textAlign: 'left' }}>Item / Part Description</th>
                <th style={{ padding: '6px 10px', textAlign: 'center', width: '80px' }}>Type</th>
                <th style={{ padding: '6px 10px', textAlign: 'center', width: '50px' }}>Qty</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', width: '80px' }}>Rate (₹)</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', width: '90px' }}>Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {itemsList.map((item, index) => (
                <tr key={index} style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <td style={{ padding: '6px 10px', color: '#64748B' }}>{index + 1}</td>
                  <td style={{ padding: '6px 10px', fontWeight: 700, color: '#0F172A' }}>{item.name}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', color: '#475569' }}>
                    {item.is_custom ? 'Custom' : 'OEM'}
                  </td>
                  <td style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 800 }}>{item.qty}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right' }}>₹{Number(item.unit_price).toFixed(2)}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 800 }}>₹{Number(item.total).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Financial Summary Box */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
          <div style={{ width: '280px', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '2px 0' }}>
              <span style={{ color: '#64748B' }}>Parts Subtotal:</span>
              <span style={{ fontWeight: 800 }}>₹{partsExp.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', padding: '2px 0' }}>
              <span style={{ color: '#64748B' }}>Labor &amp; Service Fee:</span>
              <span style={{ fontWeight: 800 }}>₹{laborCost.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', borderTop: '1.5px solid #2A195C', paddingTop: '6px', marginTop: '4px' }}>
              <span style={{ fontWeight: 900, color: '#2A195C' }}>Total Job Card Cost:</span>
              <span style={{ fontWeight: 900, color: '#2A195C' }}>₹{totalExp.toFixed(2)}</span>
            </div>
            {isRiderDamage && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', marginTop: '4px', borderTop: '1px dashed #CBD5E1', paddingTop: '4px' }}>
                <span style={{ fontWeight: 800, color: '#DC2626' }}>Amount Billed to Rider:</span>
                <span style={{ fontWeight: 900, color: '#DC2626' }}>₹{riderCharge.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Official Signatures Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginTop: '30px', borderTop: '1px solid #E2E8F0', paddingTop: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ height: '36px' }}></div>
            <div style={{ borderTop: '1px solid #475569', paddingTop: '4px', fontSize: '11px', fontWeight: 800, color: '#0F172A' }}>
              {jobCard?.assigned_technician || 'Ramesh Patel'}
            </div>
            <div style={{ fontSize: '9.5px', color: '#64748B' }}>Workshop Technician</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ height: '36px' }}></div>
            <div style={{ borderTop: '1px solid #475569', paddingTop: '4px', fontSize: '11px', fontWeight: 800, color: '#0F172A' }}>
              Workshop Lead / Manager
            </div>
            <div style={{ fontSize: '9.5px', color: '#64748B' }}>Evegah Fleet Services</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ height: '36px' }}></div>
            <div style={{ borderTop: '1px solid #475569', paddingTop: '4px', fontSize: '11px', fontWeight: 800, color: '#0F172A' }}>
              {jobCard?.rider_name ? `${jobCard.rider_name} (Rider)` : 'Fleet Operations Team'}
            </div>
            <div style={{ fontSize: '9.5px', color: '#64748B' }}>Customer / Operations Ack</div>
          </div>
        </div>

        {/* Legal Disclaimer Footer */}
        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '9px', color: '#94A3B8', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
          This document is an official computer-generated Job Card issued by Evegah Fleet Management System.
          All replaced components comply with Evegah OEM standards. Terms and conditions of the rental agreement apply.
        </div>
      </div>
    </>
  );
}
