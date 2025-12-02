// Quick test to verify sorting logic
const testMatches = [
  {
    id: '1',
    status: 'completed',
    completedAt: 1000,
    round: 'Round 1'
  },
  {
    id: '2', 
    status: 'completed',
    completedAt: 2000,
    round: 'Round 2'
  },
  {
    id: '3',
    status: 'in_progress',
    startedAt: 3000,
    round: 'Round 3'
  },
  {
    id: '4',
    status: 'pending',
    round: 'Round 4'
  }
];

// Test chronological sorting (for player paths)
const sortPlayerPathMatches = (matches) => {
  return matches.sort((a, b) => {
    if (a.status === 'completed' && b.status === 'completed') {
      const aTime = a.completedAt || a.updatedAt || 0;
      const bTime = b.completedAt || b.updatedAt || 0;
      return aTime - bTime; // Earliest first (chronological order)
    }
    
    if (a.status === 'completed' && b.status !== 'completed') return -1;
    if (b.status === 'completed' && a.status !== 'completed') return 1;
    
    if (a.status === 'in_progress' && b.status === 'pending') return -1;
    if (b.status === 'in_progress' && a.status === 'pending') return 1;
    
    return 0;
  });
};

// Test current matches sorting (for live view)
const sortCurrentMatches = (matches) => {
  return matches.sort((a, b) => {
    if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
    if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
    
    if (a.status === 'pending' && b.status === 'completed') return -1;
    if (b.status === 'pending' && a.status === 'completed') return 1;
    
    if (a.status === 'completed' && b.status === 'completed') {
      const aTime = a.completedAt || a.updatedAt || 0;
      const bTime = b.completedAt || b.updatedAt || 0;
      return bTime - aTime; // Most recent first for current matches
    }
    
    return 0;
  });
};

console.log('=== Original matches ===');
console.log(testMatches.map(m => `${m.round}: ${m.status} (${m.completedAt || m.startedAt || 'no-time'})`));

console.log('\n=== Player path sorting (chronological) ===');
const playerPath = sortPlayerPathMatches([...testMatches]);
console.log(playerPath.map(m => `${m.round}: ${m.status} (${m.completedAt || m.startedAt || 'no-time'})`));

console.log('\n=== Current matches sorting (live view) ===');
const currentMatches = sortCurrentMatches([...testMatches]);
console.log(currentMatches.map(m => `${m.round}: ${m.status} (${m.completedAt || m.startedAt || 'no-time'})`));

console.log('\n✅ Sorting logic test completed');