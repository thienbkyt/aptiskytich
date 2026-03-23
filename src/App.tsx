import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import Index from "./pages/Index";
import MockTest from "./pages/MockTest";
import Practice from "./pages/Practice";
import Dashboard from "./pages/Dashboard";
import Course from "./pages/Course";

import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import SkillPractice from "./pages/SkillPractice";
import VocabStudy from "./pages/VocabStudy";
import Speaking from "./pages/Speaking";
import Writing from "./pages/Writing";
import Listening from "./pages/Listening";
import Reading from "./pages/Reading";
import GrammarVocabulary from "./pages/GrammarVocabulary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/mock-test" element={<MockTest />} />
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
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
