import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import DictionaryProvider from "@/components/dictionary/DictionaryProvider";
import Index from "./pages/Index";

// Lazy-load non-landing routes to reduce initial bundle size
const Practice = lazy(() => import("./pages/Practice"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Course = lazy(() => import("./pages/Course"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminReport = lazy(() => import("./pages/AdminReport"));
const AdminReportPricing = lazy(() => import("./pages/AdminReportPricing"));
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
const ProgressPage = lazy(() => import("./pages/Progress"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <DictionaryProvider>
          <Suspense fallback={<div className="min-h-screen" />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/course" element={<Course />} />
            <Route path="/grammar" element={<GrammarVocabulary />} />
            <Route path="/reading" element={<Reading />} />
            <Route path="/listening" element={<Listening />} />
            <Route path="/speaking" element={<Speaking />} />
            <Route path="/writing" element={<Writing />} />
            <Route path="/vocabulary" element={<SkillPractice />} />
            <Route path="/vocabulary/:id" element={<VocabStudy />} />
            <Route path="/vocab/:listId" element={<VocabListDetail />} />
            <Route path="/thi-thu" element={<FullTest />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/:id" element={<HistoryDetail />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/report" element={<AdminReport />} />
            <Route path="/admin/report/pricing" element={<AdminReportPricing />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </DictionaryProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
