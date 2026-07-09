import { lazy, Suspense, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { FEATURES } from "@/config/features";
import ErrorBoundary from "@/components/ErrorBoundary";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import DictionaryProvider from "@/components/dictionary/DictionaryProvider";
import PageLoadingSkeleton from "@/components/layout/PageLoadingSkeleton";
import PageTransition from "@/components/layout/PageTransition";
import RouteProgressBar from "@/components/layout/RouteProgressBar";

import AICoachFab from "@/components/ai-coach/AICoachFab";
import ReportFab from "@/components/ReportFab";
import VisitLogger from "@/components/VisitLogger";
import PostLoginFBGroupModal from "@/components/PostLoginFBGroupModal";
import RequireAdmin from "@/components/auth/RequireAdmin";
import { LoginGateProvider } from "@/components/auth/LoginGate";
import useDeviceSession from "@/hooks/useDeviceSession";

const Index = lazy(() => import("./pages/Index"));


// Lazy-load non-landing routes to reduce initial bundle size

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Course = lazy(() => import("./pages/Course"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminReport = lazy(() => import("./pages/AdminReport"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminReportPricing = lazy(() => import("./pages/AdminReportPricing"));
const AdminStudents = lazy(() => import("./pages/AdminStudents"));
const AdminNotifications = lazy(() => import("./pages/AdminNotifications"));
const AdminPro = lazy(() => import("./pages/AdminPro"));
const AdminPrediction = lazy(() => import("./pages/AdminPrediction"));
const AdminDictation = lazy(() => import("./pages/AdminDictation"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SkillPractice = lazy(() => import("./pages/SkillPractice"));
const VocabStudy = lazy(() => import("./pages/VocabStudy"));
const VocabListDetail = lazy(() => import("./pages/VocabListDetail"));
const Speaking = lazy(() => import("./pages/Speaking"));
const Writing = lazy(() => import("./pages/Writing"));
const Listening = lazy(() => import("./pages/Listening"));
const Reading = lazy(() => import("./pages/Reading"));
const GrammarVocabulary = lazy(() => import("./pages/GrammarVocabulary"));
const FullTest = lazy(() => import("./pages/FullTest"));
const KeyPrediction = lazy(() => import("./pages/KeyPrediction"));
const History = lazy(() => import("./pages/History"));
const HistoryDetail = lazy(() => import("./pages/HistoryDetail"));
const FullTestHistoryDetail = lazy(() => import("./pages/FullTestHistoryDetail"));
const MarathonHistoryDetail = lazy(() => import("./pages/MarathonHistoryDetail"));
const FullPartHistoryDetail = lazy(() => import("./pages/FullPartHistoryDetail"));
const ProgressPage = lazy(() => import("./pages/Progress"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const Connect = lazy(() => import("./pages/Connect"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Dictation = lazy(() => import("./pages/Dictation"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Wrap pages that need inline dictionary lookup while taking an exam
const WithDict = ({ children }: { children: ReactNode }) => (
  <DictionaryProvider>{children}</DictionaryProvider>
);

const DeviceSessionGuard = () => {
  useDeviceSession();
  return null;
};

const BlogSlugRedirect = () => {
  const { slug } = useParams();
  return <Navigate to={`/meo-thi-aptis/${slug ?? ""}`} replace />;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <LoginGateProvider>
                <RouteProgressBar />
                <Suspense fallback={<PageLoadingSkeleton />}>
                  <PageTransition>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/reset-password" element={<ResetPassword />} />

                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/course" element={FEATURES.course ? <Course /> : <Navigate to="/" replace />} />
                      <Route path="/grammar" element={<WithDict><GrammarVocabulary /></WithDict>} />
                      <Route path="/reading" element={<WithDict><Reading /></WithDict>} />
                      <Route path="/listening" element={<WithDict><Listening /></WithDict>} />
                      <Route path="/speaking" element={<WithDict><Speaking /></WithDict>} />
                      <Route path="/writing" element={<WithDict><Writing /></WithDict>} />
                      <Route path="/vocabulary" element={<SkillPractice />} />
                      <Route path="/vocabulary/:id" element={<VocabStudy />} />
                      <Route path="/vocab/:listId" element={<VocabListDetail />} />
                      <Route path="/nghe-chep" element={<Dictation />} />
                      <Route path="/nghe-chep/:setId" element={<Dictation />} />
                      <Route path="/thi-thu" element={<WithDict><FullTest /></WithDict>} />
                      <Route path="/key-du-doan" element={<WithDict><KeyPrediction /></WithDict>} />
                      <Route path="/history" element={<History />} />
                      <Route path="/history/full-test/:sessionId" element={<WithDict><FullTestHistoryDetail /></WithDict>} />
                      <Route path="/history/marathon/:id" element={<WithDict><MarathonHistoryDetail /></WithDict>} />
                      <Route path="/history/full-part/:sessionId" element={<WithDict><FullPartHistoryDetail /></WithDict>} />
                      <Route path="/history/:id" element={<HistoryDetail />} />
                      <Route path="/progress" element={<ProgressPage />} />
                      <Route path="/pricing" element={<PricingPage />} />
                      <Route path="/connect" element={<Connect />} />
                      <Route path="/meo-thi-aptis" element={<Blog />} />
                      <Route path="/meo-thi-aptis/:slug" element={<BlogPost />} />
                      <Route path="/blog" element={<Navigate to="/meo-thi-aptis" replace />} />
                      <Route path="/blog/:slug" element={<BlogSlugRedirect />} />
                      
                      <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
                      <Route path="/admin/report" element={<RequireAdmin><AdminReport /></RequireAdmin>} />
                      <Route path="/admin/reports" element={<RequireAdmin><AdminReports /></RequireAdmin>} />
                      <Route path="/admin/report/pricing" element={<RequireAdmin><AdminReportPricing /></RequireAdmin>} />
                      <Route path="/admin/students" element={<RequireAdmin><AdminStudents /></RequireAdmin>} />
                      <Route path="/admin/notifications" element={<RequireAdmin><AdminNotifications /></RequireAdmin>} />
                      <Route path="/admin/pro" element={<RequireAdmin><AdminPro /></RequireAdmin>} />
                      <Route path="/admin/prediction" element={<RequireAdmin><AdminPrediction /></RequireAdmin>} />
                      <Route path="/admin/nghe-chep" element={<RequireAdmin><AdminDictation /></RequireAdmin>} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </PageTransition>
                </Suspense>
                <AICoachFab />
                <ReportFab />
                <VisitLogger />
                <PostLoginFBGroupModal />
                <DeviceSessionGuard />
              </LoginGateProvider>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
