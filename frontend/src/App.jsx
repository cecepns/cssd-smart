import { Suspense, lazy } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import ResourcePage from '@/components/resource/ResourcePage';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/config/routes';
import {
  dryingsConfig,
  packagingsConfig,
  receiptsConfig,
  sterilizationsConfig,
  verificationsConfig,
  washingsConfig,
} from '@/config/resources/process';
import { distGauzeConfig, distToolsConfig } from '@/config/resources/distribution';
import { dttControlConfig, dttDistributionsConfig, dttReceiptsConfig } from '@/config/resources/dtt';
import { bmhpInConfig, bmhpItemsConfig, bmhpMutationConfig, bmhpOutConfig } from '@/config/resources/stock';
import { machineLogsConfig } from '@/config/resources/machineLogs';
import {
  itemUnitsConfig,
  itemsConfig,
  itemsDttConfig,
  itemsSterilConfig,
  machinesConfig,
  officersConfig,
  packagingMaterialsConfig,
  unitsConfig,
  usersConfig,
} from '@/config/resources/master';

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const InstrumentSetsPage = lazy(() => import('@/pages/InstrumentSetsPage'));
const TraceabilityPage = lazy(() => import('@/pages/TraceabilityPage'));
const BmhpHubPage = lazy(() => import('@/pages/BmhpHubPage'));
const ReportsHubPage = lazy(() => import('@/pages/ReportsHubPage'));
const ReportPage = lazy(() => import('@/pages/ReportPage'));
const GuidePage = lazy(() => import('@/pages/GuidePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const CounterBarcodePage = lazy(() => import('@/pages/CounterBarcodePage'));
const UnitTrackingPage = lazy(() => import('@/pages/UnitTrackingPage'));
const ProcessTimingMonitorPage = lazy(() => import('@/pages/ProcessTimingMonitorPage'));
const UnitRequisitionsPage = lazy(() => import('@/pages/UnitRequisitionsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

const PageLoader = () => (
  <div className="flex min-h-[40vh] items-center justify-center text-brand-700" role="status" aria-label="Memuat">
    <Loader2 size={30} className="animate-spin" />
  </div>
);

/** Route terlindungi: wajib login, opsional khusus admin atau petugas CSSD/admin. */
function Protected({ adminOnly = false, cssdOnly = false }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  if (adminOnly && !isAdmin) return <Navigate to={ROUTES.HOME} replace />;
  if (cssdOnly && user.role === 'unit') return <Navigate to={ROUTES.HOME} replace />;
  return <Outlet />;
}

/** key memastikan state list (search, page, sort) di-reset saat pindah halaman. */
const resource = (config) => <ResourcePage key={config.key} config={config} />;

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route path={ROUTES.UNIT_TRACKING} element={<UnitTrackingPage />} />

        <Route element={<Protected />}>
          <Route element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />

            <Route path={ROUTES.RECEIPTS} element={resource(receiptsConfig)} />
            <Route path={ROUTES.UNIT_REQUISITIONS} element={<UnitRequisitionsPage />} />
            <Route path={ROUTES.INSTRUMENT_SETS} element={<InstrumentSetsPage />} />
            <Route path={ROUTES.DIST_TOOLS} element={resource(distToolsConfig)} />
            <Route path={ROUTES.DIST_GAUZE} element={resource(distGauzeConfig)} />
            <Route path={ROUTES.DTT_RECEIPTS} element={resource(dttReceiptsConfig)} />
            <Route path={ROUTES.DTT_DISTRIBUTIONS} element={resource(dttDistributionsConfig)} />
            <Route path={ROUTES.TRACE} element={<TraceabilityPage />} />
            <Route path={ROUTES.GUIDE} element={<GuidePage />} />
            <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />

            <Route element={<Protected cssdOnly />}>
              <Route path={ROUTES.WASHINGS} element={resource(washingsConfig)} />
              <Route path={ROUTES.DRYINGS} element={resource(dryingsConfig)} />
              <Route path={ROUTES.PACKAGINGS} element={resource(packagingsConfig)} />
              <Route path={ROUTES.STERILIZATIONS} element={resource(sterilizationsConfig)} />
              <Route path={ROUTES.VERIFICATIONS} element={resource(verificationsConfig)} />
              <Route path={ROUTES.MACHINE_LOGS} element={resource(machineLogsConfig)} />
              <Route path={ROUTES.PROCESS_TIMINGS} element={<ProcessTimingMonitorPage />} />
              <Route path={ROUTES.DTT_CONTROL} element={resource(dttControlConfig)} />

              <Route path={ROUTES.BMHP} element={<BmhpHubPage />} />
              <Route path={ROUTES.BMHP_IN} element={resource(bmhpInConfig)} />
              <Route path={ROUTES.BMHP_OUT} element={resource(bmhpOutConfig)} />
              <Route path={ROUTES.BMHP_STOCK} element={resource(bmhpItemsConfig)} />
            </Route>

            <Route element={<Protected adminOnly />}>
              <Route path={ROUTES.BMHP_REPORT} element={resource(bmhpMutationConfig)} />
              <Route path={ROUTES.REPORTS} element={<ReportsHubPage />} />
              <Route path={`${ROUTES.REPORTS}/:slug`} element={<ReportPage />} />
              <Route path={ROUTES.COUNTER_BARCODE} element={<CounterBarcodePage />} />
              <Route path={ROUTES.MASTER_UNITS} element={resource(unitsConfig)} />
              <Route path={ROUTES.MASTER_ITEM_UNITS} element={resource(itemUnitsConfig)} />
              <Route path={ROUTES.MASTER_ITEMS_STERIL} element={resource(itemsSterilConfig)} />
              <Route path={ROUTES.MASTER_ITEMS_DTT} element={resource(itemsDttConfig)} />
              <Route path={ROUTES.MASTER_ITEMS} element={resource(itemsConfig)} />
              <Route path={ROUTES.MASTER_MACHINES} element={resource(machinesConfig)} />
              <Route path={ROUTES.MASTER_PACKAGING_MATERIALS} element={resource(packagingMaterialsConfig)} />
              <Route path={ROUTES.MASTER_OFFICERS} element={resource(officersConfig)} />
              <Route path={ROUTES.MASTER_USERS} element={resource(usersConfig)} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
