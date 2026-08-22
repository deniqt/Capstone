import { useState } from "react";
import MainHeader from '../MainComponent/MainHeader';
import TeacherSidebar from './Component/TeacherSidebar';
import './teacherDashboard.css';
import { Outlet } from "react-router-dom";

function TeacherDashboard() {

    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div
            className={`teacher-dashboard ${
                sidebarOpen ? "sidebar-open" : ""
            }`}
        >

            {/* Mobile hamburger */}
            <button
                className="mobile-menu-button"
                onClick={() =>
                    setSidebarOpen(!sidebarOpen)
                }
            >
                ☰
            </button>

            {/* Overlay */}
            {sidebarOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() =>
                        setSidebarOpen(false)
                    }
                />
            )}

            <TeacherSidebar />

            <div className="teacher-main-content">

                <MainHeader />

                <Outlet />

            </div>

        </div>
    );
}

export default TeacherDashboard;