/**
 * Zone Helper Utilities for Multi-Zone Management
 */

function parseZoneParam(rawZone) {
  if (!rawZone || typeof rawZone !== 'string') return [];
  const parts = rawZone.split(',')
    .map(s => s.trim())
    .filter(s => {
      const lower = s.toLowerCase();
      return lower && 
        lower !== 'all zones' && 
        lower !== 'all zones / platform wide' && 
        lower !== 'all' && 
        lower !== 'multiple zones';
    });
  return parts;
}

function buildZoneSqlFilter(rawZone, columns, params, paramIndex) {
  const targetZones = parseZoneParam(rawZone);
  if (targetZones.length === 0) {
    return { sqlClause: '', nextParamIndex: paramIndex };
  }

  const colList = Array.isArray(columns) ? columns : [columns];
  const orConditions = [];

  targetZones.forEach(tz => {
    // Also include cleaned token (without 'zone' or 'hub') for robust matching
    const cleanTz = tz.replace(/zone|hub|sf|\(.*?\)|-/gi, '').trim();
    colList.forEach(col => {
      orConditions.push(`${col} ILIKE $${paramIndex}`);
    });
    params.push(`%${tz}%`);
    paramIndex++;

    if (cleanTz && cleanTz.length >= 3 && cleanTz.toLowerCase() !== tz.toLowerCase()) {
      colList.forEach(col => {
        orConditions.push(`${col} ILIKE $${paramIndex}`);
      });
      params.push(`%${cleanTz}%`);
      paramIndex++;
    }
  });

  return {
    sqlClause: ` AND (${orConditions.join(' OR ')}) `,
    nextParamIndex: paramIndex
  };
}

module.exports = {
  parseZoneParam,
  buildZoneSqlFilter
};
