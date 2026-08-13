import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../Services/NotificationContext";
import "./MainHeader.css";

function MainHeader() {

    const navigate = useNavigate();

    const [showNotifications, setShowNotifications] = useState(false);

    const {
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead
    } = useNotifications();


    function handleNotificationClick(notification) {

        // Mark as read
        if (!notification.is_read) {
            markAsRead(notification.notification_id);
        }

        // Navigate if notification has an action URL
        if (notification.action_url) {
            navigate(notification.action_url);
        }

        // Close dropdown
        setShowNotifications(false);
    }


    return (

        <header className="header">

            <div className="notification-container">

                {/* Notification Bell */}

                <button
                    className="notification-bell"
                    onClick={() =>
                        setShowNotifications(
                            previous => !previous
                        )
                    }
                >

                    🔔

                    {unreadCount > 0 && (

                        <span className="notification-badge">
                            {unreadCount}
                        </span>

                    )}

                </button>


                {/* Notification Dropdown */}

                {showNotifications && (

                    <div className="notification-dropdown">

                        <div className="notification-header">

                            <h3>
                                Notifications
                            </h3>

                            {unreadCount > 0 && (

                                <button
                                    className="mark-all-button"
                                    onClick={markAllAsRead}
                                >
                                    Mark all as read
                                </button>

                            )}

                        </div>


                        {/* No notifications */}

                        {notifications.length === 0 ? (

                            <div className="no-notifications">

                                <p>
                                    🔕 No notifications
                                </p>

                            </div>

                        ) : (

                            <div className="notification-list">

                                {notifications.map(
                                    notification => (

                                        <button
                                            key={
                                                notification.notification_id
                                            }
                                            className={`notification-item ${
                                                !notification.is_read
                                                    ? "unread"
                                                    : ""
                                            }`}
                                            onClick={() =>
                                                handleNotificationClick(
                                                    notification
                                                )
                                            }
                                        >

                                            <div className="notification-icon">

                                                {notification.type ===
                                                "Assignment"
                                                    ? "📝"
                                                    : notification.type ===
                                                      "Material"
                                                    ? "📚"
                                                    : notification.type ===
                                                      "Grade"
                                                    ? "✅"
                                                    :notification.type === "Message"
                                                    ? "💬"
                                                    : "🔔"}

                                            </div>


                                            <div className="notification-content">

                                                <strong>
                                                    {
                                                        notification.title
                                                    }
                                                </strong>

                                                <p>
                                                    {
                                                        notification.message
                                                    }
                                                </p>

                                                <small>
                                                    {new Date(
                                                        notification.created_at
                                                    ).toLocaleString()}
                                                </small>

                                            </div>


                                            {!notification.is_read && (

                                                <span className="unread-dot">
                                                    ●
                                                </span>

                                            )}

                                        </button>

                                    )
                                )}

                            </div>

                        )}

                    </div>

                )}

            </div>

        </header>

    );
}

export default MainHeader;