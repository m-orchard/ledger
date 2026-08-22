import { useEffect, useMemo, useState } from 'react';
import { EXPENSE_CATEGORY_LABELS } from './types';
import { usePersistedData } from './lib/storage';
import { buildDefaultData } from './data/defaultData';
import { runProjection, toYearlyPoints, pointAtAge } from './lib/projection';
import { AppSettingsProvider } from './lib/AppSettingsContext';
import LineItemTable from './components/LineItemTable';
import Accounts from './components/Accounts';
import PensionsAndLisas from './components/PensionsAndLisas';
import Assets from './components/Assets';
import Loans from './components/Loans';
import Salaries from './components/Salaries';
import OneOffEvents from './components/OneOffEvents';
import SettingsPanel from './components/SettingsPanel';
import NetWorthChart from './components/NetWorthChart';
import SummaryCards from './components/SummaryCards';
import PersonSummary from './components/PersonSummary';

type Tab = 'dashboard' | 'income' | 'outgoings' | 'accounts' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'income', label: 'Income' },
  { id: 'outgoings', label: 'Outgoings' },
  { id: 'accounts', label: 'Investments & Assets' },
  { id: 'settings', label: 'Settings' },
];

const TAB_IDS = TABS.map((t) => t.id);

function tabFromHash(): Tab {
  const hash = window.location.hash.slice(1);
  return (TAB_IDS as string[]).includes(hash) ? (hash as Tab) : 'dashboard';
}

export default function App() {
  const [data, setData] = usePersistedData(buildDefaultData());
  const [tab, setTab] = useState<Tab>(tabFromHash);

  useEffect(() => {
    // Normalise a missing/invalid hash on first load so the URL always reflects the active tab.
    if (window.location.hash.slice(1) !== tab) {
      window.location.hash = tab;
    }
    function onHashChange() {
      setTab(tabFromHash());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  function selectTab(next: Tab) {
    setTab(next);
    window.location.hash = next;
  }

  const points = useMemo(() => runProjection(data), [data]);
  const yearlyPoints = useMemo(() => toYearlyPoints(points), [points]);
  const atRetirement = pointAtAge(points, data.settings.retirementAge);
  const currentAccountBalances = data.accounts.reduce((s, a) => s + a.balance, 0);
  const currentAssetValue = data.assets.reduce((s, a) => s + a.value, 0);
  const currentDebt = data.loans.reduce((s, l) => s + l.balance, 0);
  const currentNetWorth = currentAccountBalances + currentAssetValue - currentDebt;
  const monthlyCashSurplus = points[0]?.monthlyCashSurplus ?? 0;

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finance-forecast-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (parsed.accounts && parsed.settings) {
          setData(parsed);
        } else {
          alert('That file doesn\'t look like a valid forecast export.');
        }
      } catch {
        alert('Could not read that file as JSON.');
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-rule bg-surface/60">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <h1 className="font-display text-3xl text-ink">Ledger</h1>
          <p className="text-sm text-inkfaint">A long-term forecast of your income, outgoings, and savings.</p>
        </div>

        <nav className="max-w-5xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTab(t.id)}
              className={`px-3 py-2 text-sm border-b-2 whitespace-nowrap ${
                tab === t.id
                  ? 'border-brass text-ink font-medium'
                  : 'border-transparent text-inkfaint hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <AppSettingsProvider
          value={{ people: data.people, sharedColor: data.settings.sharedColor, currency: data.settings.currency }}
        >
          {tab === 'dashboard' && (
            <>
              <SummaryCards
                currentNetWorth={currentNetWorth}
                currentDebt={currentDebt}
                atRetirement={atRetirement}
                retirementAge={data.settings.retirementAge}
                monthlyCashSurplus={monthlyCashSurplus}
              />
              <NetWorthChart points={yearlyPoints} retirementAge={data.settings.retirementAge} />
              {monthlyCashSurplus < 0 && (
                <div className="bg-brick/10 border border-brick/40 rounded-sm p-4 text-sm text-brick">
                  Your income doesn't currently cover your outgoings plus planned contributions —
                  by {formatShortfall(monthlyCashSurplus, data.settings.currency)} a month. Check the
                  Income and Outgoings tabs.
                </div>
              )}
              <PersonSummary data={data} />
            </>
          )}

          {tab === 'income' && (
            <div className="space-y-6">
              <Salaries
                salaries={data.salaries}
                accounts={data.accounts}
                tax={data.settings.tax}
                onChange={(salaries) => setData({ ...data, salaries })}
              />
              <LineItemTable
                title="Other income"
                hint="Regular income already after tax — rental, side income, etc. Salaries go above."
                items={data.income}
                accent="teal"
                onChange={(income) => setData({ ...data, income })}
              />
              <OneOffEvents
                events={data.oneOffs.filter((e) => e.kind === 'income')}
                accounts={data.accounts}
                loans={data.loans}
                assets={data.assets}
                fixedKind="income"
                onChange={(income) =>
                  setData({ ...data, oneOffs: [...data.oneOffs.filter((e) => e.kind !== 'income'), ...income] })
                }
              />
            </div>
          )}

          {tab === 'outgoings' && (
            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <LineItemTable
                  title={EXPENSE_CATEGORY_LABELS.regular}
                  hint="Bills, subscriptions, and other fixed recurring payments."
                  items={data.expenses.filter((e) => e.category === 'regular')}
                  accent="brick"
                  fixedCategory="regular"
                  onChange={(regular) =>
                    setData({ ...data, expenses: [...data.expenses.filter((e) => e.category !== 'regular'), ...regular] })
                  }
                />
                <LineItemTable
                  title={EXPENSE_CATEGORY_LABELS.variable}
                  hint="Groceries, fuel, and other day-to-day spending that varies month to month."
                  items={data.expenses.filter((e) => e.category === 'variable')}
                  accent="brick"
                  fixedCategory="variable"
                  onChange={(variable) =>
                    setData({ ...data, expenses: [...data.expenses.filter((e) => e.category !== 'variable'), ...variable] })
                  }
                />
              </div>
              <Loans
                loans={data.loans}
                assets={data.assets}
                onChange={(loans) => setData({ ...data, loans })}
              />
              <OneOffEvents
                events={data.oneOffs.filter((e) => e.kind === 'expense')}
                accounts={data.accounts}
                loans={data.loans}
                assets={data.assets}
                fixedKind="expense"
                onChange={(expense) =>
                  setData({ ...data, oneOffs: [...data.oneOffs.filter((e) => e.kind !== 'expense'), ...expense] })
                }
              />
            </div>
          )}

          {tab === 'accounts' && (
            <div className="space-y-6">
              <PensionsAndLisas
                accounts={data.accounts}
                salaries={data.salaries}
                tax={data.settings.tax}
                onChange={(accounts) => setData({ ...data, accounts })}
              />
              <Accounts accounts={data.accounts} onChange={(accounts) => setData({ ...data, accounts })} />
              <Assets assets={data.assets} onChange={(assets) => setData({ ...data, assets })} />
            </div>
          )}

          {tab === 'settings' && (
            <SettingsPanel
              settings={data.settings}
              onChange={(settings) => setData({ ...data, settings })}
              people={data.people}
              onPeopleChange={(people) => setData({ ...data, people })}
              onExport={exportData}
              onImport={importData}
            />
          )}
        </AppSettingsProvider>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-8 text-xs text-inkfaint">
        Data is stored only in this browser (localStorage). Use Settings → Export data to back it up.
      </footer>
    </div>
  );
}

function formatShortfall(amount: number, currency: 'GBP' | 'USD' | 'EUR') {
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : '€';
  return `${symbol}${Math.abs(Math.round(amount)).toLocaleString()}`;
}
