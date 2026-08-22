import { useState } from "react";
import StudentSidebar from './Component/StudentSidebar';
import './studentDashboard.css';
import { Outlet } from "react-router-dom";

function StudentDashboard() {

    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div
            className={`student-dashboard ${
                sidebarOpen ? "sidebar-open" : ""
            }`}
        >

            {/* Mobile Menu Button */}
            <button
                className="student-mobile-menu-button"
                onClick={() =>
                    setSidebarOpen(!sidebarOpen)
                }
            >
                ☰
            </button>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="student-sidebar-overlay"
                    onClick={() =>
                        setSidebarOpen(false)
                    }
                />
            )}

            <StudentSidebar />

            <div className="student-main-content">
                <Outlet />
            </div>

        </div>
    );
}

export default StudentDashboard;