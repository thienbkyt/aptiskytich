import { lazy, Suspense, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
const History = lazy(() => import("./pages/History"));
const HistoryDetail = lazy(() => import("./pages/HistoryDetail"));
const FullTestHistoryDetail = lazy(() => import("./pages/FullTestHistoryDetail"));
const ProgressPage = lazy(() => import("./pages/Progress"));

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <RouteProgressBar />
          <Suspense fallback={<PageLoadingSkeleton />}>
          <PageTransition>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/course" element={<Course />} />
            <Route path="/grammar" element={<WithDict><GrammarVocabulary /></WithDict>} />
            <Route path="/reading" element={<WithDict><Reading /></WithDict>} />
            <Route path="/listening" element={<WithDict><Listening /></WithDict>} />
            <Route path="/speaking" element={<WithDict><Speaking /></WithDict>} />
            <Route path="/writing" element={<WithDict><Writing /></WithDict>} />
            <Route path="/vocabulary" element={<SkillPractice />} />
            <Route path="/vocabulary/:id" element={<VocabStudy />} />
            <Route path="/vocab/:listId" element={<VocabListDetail />} />
            <Route path="/thi-thu" element={<WithDict><FullTest /></WithDict>} />
            <Route path="/history" element={<History />} />
            <Route path="/history/full-test/:sessionId" element={<WithDict><FullTestHistoryDetail /></WithDict>} />
            <Route path="/history/:id" element={<HistoryDetail />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/report" element={<AdminReport />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/report/pricing" element={<AdminReportPricing />} />
            <Route path="/admin/students" element={<AdminStudents />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </PageTransition>
          </Suspense>
          <AICoachFab />
          <ReportFab />
        </AuthProvider>
      </BrowserRouter>

    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
