'use client';
export default function Dashboard() {
  return (
    <div style={{ padding: '50px', backgroundColor: '#0f0f0f', color: 'white', minHeight: '100vh', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '20px' }}>✅ BUILD TEST SUCCESS</h1>
      <p style={{ fontSize: '1.2rem', color: '#66ff66' }}>Your build system works!</p>
      <p style={{ marginTop: '30px', color: '#aaa' }}>Original dashboard code has an issue. Check build errors above.</p>
    </div>
  );
}
