
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import MainHeader from "../../MainComponent/MainHeader";
import "./studentSidebar.css"

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
    <div className="sidebar">
        <h2>Yoseff Student Side</h2> 

        <nav className="sidebar-nav">

          <NavLink to="/student" end>
              Dashboard
          </NavLink>

          <NavLink to="/student/materials">
              Material
          </NavLink>

          <NavLink to="/student/progress">
              Progress
          </NavLink>

          <NavLink to="/student/schedule">
              Schedule
          </NavLink>

          <NavLink to="/student/messages">
              Messages
          </NavLink>

          <NavLink to="/student/settings">
              Settings
          </NavLink>

          <button onClick={handleLogout}>
              Log Out
          </button>

      </nav>

    </div>
);

}

export default StudentSidebar