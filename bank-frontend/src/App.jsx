import React, { useState } from 'react';

function App() {
  const [view, setView] = useState('login'); // login, dashboard, epu
  const [showModal, setShowModal] = useState(false);
  const [balance, setBalance] = useState(15000.00);
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('idle'); // idle, processing, success, error
  const [logs, setLogs] = useState([]);
  const [holdings, setHoldings] = useState({ units: 0, value: 0 });

  const SHARE_PRICE = 10; // 10 KYD per share

  const handleLogin = (e) => {
    e.preventDefault();
    setView('dashboard');
  };

  const handlePurchase = async () => {
    setStatus('processing');
    setLogs(prev => [...prev, 'Initiating purchase...']);

    try {
      setLogs(prev => [...prev, 'Contacting Bank Node...']);

      // Call the Bank Node Backend
      // Note: In a real app we'd use an environment variable for the URL
      // Using HTTP port 3002 to avoid self-signed cert issues in browser
      const response = await fetch('http://localhost:3002/client-trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          investorName: '[INVESTOR_DEMO_USER]',
          sourceAccount: document.getElementById('sourceAccount')?.value || 'ACC-998877'
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        const investedAmount = parseFloat(amount);
        const newUnits = investedAmount / SHARE_PRICE;

        setBalance(prev => prev - investedAmount);
        setHoldings(prev => ({
          units: prev.units + newUnits,
          value: prev.value + investedAmount
        }));

        setLogs(prev => [...prev, 'Transaction Complete.', 'Digital Warranty Issued.', `Ref: ${data.data?.member_id || 'N/A'}`]);
      } else {
        setStatus('error');
        setLogs(prev => [...prev, `Error: ${data.message || 'Unknown error'}`]);
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      setLogs(prev => [...prev, `Connection Error: ${err.message}`]);
    }
  };

  if (view === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bank-gray">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md border-t-4 border-bank-blue">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-bank-blue tracking-wide">[PARTNER_BANK]</h1>
            <p className="text-sm text-gray-500 mt-2">Private Banking Portal</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <input
                type="text"
                value="[INVESTOR_DEMO_USER]"
                readOnly
                className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-bank-blue focus:border-bank-blue sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                value="••••••••••••"
                readOnly
                className="mt-1 block w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-bank-blue focus:border-bank-blue sm:text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-bank-blue hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bank-blue transition-colors"
            >
              Secure Login
            </button>
          </form>
          <div className="mt-6 text-center text-xs text-gray-400">
            <p>Authorized Access Only. Monitored 24/7.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bank-gray flex flex-col">
      {/* Header */}
      <header className="bg-bank-blue text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <h1 className="text-xl font-bold tracking-wider">[PARTNER_BANK]</h1>
            <nav className="hidden md:flex space-x-4">
              <button onClick={() => setView('dashboard')} className={`px-3 py-2 rounded-md text-sm font-medium ${view === 'dashboard' ? 'bg-blue-900' : 'hover:bg-blue-800'}`}>Dashboard</button>
              <button className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-800 text-gray-300 cursor-not-allowed">Transfers</button>
              <button onClick={() => setView('epu')} className={`px-3 py-2 rounded-md text-sm font-medium ${view === 'epu' ? 'bg-bank-gold text-bank-blue' : 'hover:bg-blue-800'}`}>Investments</button>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm">Welcome, [INVESTOR_DEMO_USER]</span>
            <button onClick={() => setView('login')} className="text-xs border border-white px-2 py-1 rounded hover:bg-blue-800">Logout</button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {view === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg leading-6 font-medium text-gray-900">Checking Account</h3>
                <div className="mt-2 max-w-xl text-sm text-gray-500">
                  <p>Account Number: **** **** **** 8832</p>
                </div>
                <div className="mt-5">
                  <div className="text-3xl font-bold text-gray-900">KYD {balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                  <p className="text-xs text-green-600 mt-1">Available Balance</p>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-4 sm:px-6">
                <div className="text-sm">
                  <a href="#" className="font-medium text-bank-blue hover:text-blue-800">View recent transactions</a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h4 className="font-medium text-gray-900 mb-4">Quick Actions</h4>
                <div className="grid grid-cols-2 gap-4">
                  <button className="p-4 border rounded-lg text-center hover:bg-gray-50 text-sm text-gray-600">Pay Bill</button>
                  <button className="p-4 border rounded-lg text-center hover:bg-gray-50 text-sm text-gray-600">Transfer Funds</button>
                </div>
              </div>
              <div className="bg-gradient-to-br from-bank-blue to-blue-900 shadow rounded-lg p-6 text-white">
                <h4 className="font-medium mb-2">Investment Opportunities</h4>
                <p className="text-sm text-blue-100 mb-4">Explore our new Sovereign Investment products.</p>
                <button onClick={() => setView('epu')} className="bg-bank-gold text-bank-blue px-4 py-2 rounded text-sm font-bold hover:bg-yellow-500 transition-colors">
                  View Offerings
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'epu' && (
          <div className="space-y-6">
            <div className="bg-white shadow-lg rounded-lg overflow-hidden border-t-4 border-bank-gold">
              <div className="p-6 md:p-10">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Investments</h2>
                  </div>
                  <span className="bg-green-100 text-green-800 text-xs font-semibold px-2.5 py-0.5 rounded">Active Offering</span>
                </div>

                {holdings.units > 0 && (
                  <div className="mt-6 bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <h4 className="text-sm font-bold text-bank-blue uppercase tracking-wide mb-2">Your Holdings</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Total Units</p>
                        <p className="text-xl font-bold text-gray-900">{holdings.units.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Total Value</p>
                        <p className="text-xl font-bold text-gray-900">KYD {holdings.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Product Card */}
                  <div className="col-span-2 border rounded-xl p-6 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-bank-blue">EPU Shares</h3>
                      <span className="text-sm font-mono text-gray-500">ISIN: KY000000EPU1</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-6">
                      Economic Participation Units
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-center mb-6">
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-500">Yield</div>
                        <div className="font-bold text-green-600">5.2% APY</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded">
                        <div className="text-xs text-gray-500">Min. Inv</div>
                        <div className="font-bold">KYD 100</div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowModal(true)}
                      className="w-full bg-bank-blue text-white py-3 rounded-lg font-medium hover:bg-blue-900 transition-colors"
                    >
                      Purchase Allocation
                    </button>
                  </div>

                  {/* Info Sidebar */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h4 className="font-medium text-gray-900 mb-4">Why Invest?</h4>
                    <ul className="space-y-3 text-sm text-gray-600">
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span> Own local assets
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span> Just for Caymanians
                      </li>
                      <li className="flex items-start">
                        <span className="text-green-500 mr-2">✓</span> Participate in our national prosperity
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Purchase EPU Shares</h3>
              <button onClick={() => { setShowModal(false); setStatus('idle'); setLogs([]); }} className="text-gray-400 hover:text-gray-500">
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            {status === 'success' ? (
              <div className="text-center py-6">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg leading-6 font-medium text-gray-900">Transaction Complete</h3>
                <div className="mt-2 px-7 py-3">
                  <p className="text-sm text-gray-500">
                    Your digital warranty has been issued and your holdings have been updated.
                  </p>
                </div>
                <div className="mt-4 bg-gray-50 p-3 rounded text-left text-xs font-mono text-gray-600 overflow-x-auto">
                  {logs.map((log, i) => <div key={i}>{log}</div>)}
                </div>
                <div className="mt-5">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-bank-blue text-base font-medium text-white hover:bg-blue-900 focus:outline-none sm:text-sm"
                    onClick={() => { setShowModal(false); setStatus('idle'); setLogs([]); }}
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Source Account</label>
                  <select
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-bank-blue focus:border-bank-blue sm:text-sm mb-3"
                    id="sourceAccount"
                  >
                    <option value="ACC-998877">Checking - **** 8832 (KYD {balance.toLocaleString()})</option>
                    <option value="ACC-112233">Savings - **** 2233 (KYD 5,000.00)</option>
                  </select>

                  <label className="block text-sm font-medium text-gray-700 mb-1">Investment Amount (KYD)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="100"
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-bank-blue focus:border-bank-blue sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">Available Balance: KYD {balance.toLocaleString()}</p>
                </div>

                {status === 'processing' && (
                  <div className="mb-4 bg-blue-50 p-3 rounded text-xs text-blue-700 font-mono">
                    {logs.map((log, i) => <div key={i}>{log}</div>)}
                  </div>
                )}

                {status === 'error' && (
                  <div className="mb-4 bg-red-50 p-3 rounded text-xs text-red-700 font-mono">
                    {logs.map((log, i) => <div key={i}>{log}</div>)}
                  </div>
                )}

                <div className="mt-5 sm:mt-6">
                  <button
                    type="button"
                    disabled={status === 'processing' || !amount}
                    onClick={handlePurchase}
                    className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:text-sm ${status === 'processing' || !amount ? 'bg-gray-400 cursor-not-allowed' : 'bg-bank-blue hover:bg-blue-900'}`}
                  >
                    {status === 'processing' ? 'Processing...' : 'Confirm Transaction'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
