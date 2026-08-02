
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

function StudentSidebar(){
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
    <div
    style={{
        width: "250px",
        background: "#222",
        color: "white",
        padding: "20px",
      }}
    >
        <h2>Yoseff Student Side</h2>

        <nav style={{
            display: "flex",
            flexDirection: "column",
            gap: "15px",  
        }}>

               <NavLink to="/student">Dashboard</NavLink>
               <NavLink to="/student/material">Material</NavLink>
               <NavLink to="/student/progress">Progress</NavLink>
               <NavLink to="/student/enrollment">Enrollment</NavLink>
               <NavLink to="/student/schedule">Schedule</NavLink> 
               <NavLink to="/student/settings">Settings</NavLink> 
               <button onClick={handleLogout}>
                Log Out
               </button>
        </nav>

    </div>
);

}

export default StudentSidebar