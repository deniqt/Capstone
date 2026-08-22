import { useState } from "react";
import { Outlet } from "react-router-dom";
import AdminSidebar from "./Component/AdminSidebar";
import "./adminDashboard.css";

function AdminDashboard() {

    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div
            className={`admin-dashboard ${
                sidebarOpen ? "sidebar-open" : ""
            }`}
        >

            {/* Mobile Menu Button */}
            <button
                className="admin-mobile-menu-button"
                onClick={() =>
                    setSidebarOpen(!sidebarOpen)
                }
            >
                ☰
            </button>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="admin-sidebar-overlay"
                    onClick={() =>
                        setSidebarOpen(false)
                    }
                />
            )}

            <AdminSidebar />

            <div className="admin-main-content">
                <Outlet />
            </div>

        </div>
    );
}

export default AdminDashboard;