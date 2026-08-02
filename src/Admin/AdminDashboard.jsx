
import { Outlet } from "react-router-dom";
import AdminSidebar from "./Component/AdminSidebar";

function AdminDashboard(){
return(
    <div style={{ display: "flex", height: "100vh" }}>
        
       <AdminSidebar/>
         <div style={{ flex: 1, padding: "20px" }}>
             <Outlet />
        </div>
    </div>

    
);
}
export default AdminDashboard