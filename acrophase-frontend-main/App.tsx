import React from "react";
import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Home from "./src/pages/Home";
import Search from "./src/pages/Search";
import Reports from "./src/pages/Reports";
import ProfilingReport from "./src/pages/ProfilingReport";
import CPETReport from "./src/pages/CPETReport";
import NotFound from "./src/pages/NotFound";

const App: React.FC = () => {
  return (
    <Theme appearance="inherit" radius="large" scaling="100%">
      <Router>
        <main className="min-h-screen font-sans">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<Search />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/cpet" element={<CPETReport />} />
            <Route path="/reports/profiling" element={<ProfilingReport />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ToastContainer
            position="top-right"
            autoClose={3000}
            newestOnTop
            closeOnClick
            pauseOnHover
          />
        </main>
      </Router>
    </Theme>
  );
};

export default App;
