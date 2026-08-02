import { supabase } from '../../lib/supabase';
import './adminSidebar.css'
import { NavLink, useNavigate } from "react-router-dom";
function AdminSidebar(){

      const navigate = useNavigate();

    async function handleLogout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    alert(error.message);
    return;
  }
    navigate("/");

}
return(
    <div className="sidebar" >
        <h2>Yoseff Admin Side</h2>

        <nav className="sidebar-nav">

               <NavLink to="/admin" end>Dashboard</NavLink>
               <NavLink to="/admin/schedule">schedule</NavLink>
               <NavLink to="/admin/student-and-tutor">Student & Tutor</NavLink>
               <NavLink to="/admin/payment">Payment</NavLink>
               <NavLink to="/admin/report">Report</NavLink>
               <NavLink to="/admin/settings">settings</NavLink>
               <NavLink to="/">Log Out</NavLink> 
               <button onClick={handleLogout}>
                Log Out
               </button>

        </nav>

    </div>
);

}

export default AdminSidebar