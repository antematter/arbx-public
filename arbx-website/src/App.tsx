import Home from "./pages/Home/Home";
import ViewDetails from "./pages/ViewDetails/ViewDetails";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

function App() {
  return (
    <div className="bg-black h-screen text-white font-roobert overflow-hidden text-center">
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/features" element={<ViewDetails />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;
