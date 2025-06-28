import { HashRouter as Router, Routes, Route } from "react-router-dom";
import AdminPage from "./pages/AdminPage";
import MissionPage from "./pages/MissionPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/mission/:missionId" element={<MissionPage />} />
      </Routes>
    </Router>
  );
}

export default App;
