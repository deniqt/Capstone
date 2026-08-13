import {
    createContext,
    useContext,
    useEffect,
    useState
} from "react";

import { supabase } from "../lib/supabase";

const NotificationContext = createContext();

export function NotificationProvider({ children }) {

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState(null);


    // ==========================================
    // GET LOGGED-IN SYSTEM USER
    // ==========================================

    useEffect(() => {

        async function getLoggedInUser() {

            const {
                data: { user },
                error: authError
            } = await supabase.auth.getUser();

            if (authError || !user) {

                console.log("No authenticated user.");

                setLoading(false);

                return;
            }


            const { data, error } = await supabase
                .from("users")
                .select("id")
                .eq("auth_id", user.id)
                .single();


            if (error) {

                console.log(
                    "Failed to get system user:",
                    error
                );

                setLoading(false);

                return;
            }


            setUserId(data.id);

        }


        getLoggedInUser();

    }, []);


    // ==========================================
    // LOAD NOTIFICATIONS
    // ==========================================

    useEffect(() => {

        if (!userId) {
            return;
        }


        async function loadNotifications() {

            const {
                data,
                error
            } = await supabase

                .from("notifications")

                .select("*")

                .eq(
                    "user_id",
                    userId
                )

                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


            if (error) {

                console.log(
                    "Failed to load notifications:",
                    error
                );

                setLoading(false);

                return;
            }


            setNotifications(
                data || []
            );

            setLoading(false);

        }


        loadNotifications();

    }, [userId]);


    // ==========================================
    // REALTIME NOTIFICATIONS
    // ==========================================

    useEffect(() => {

        if (!userId) {
            return;
        }


        const channel = supabase

            .channel(
                `notifications-${userId}`
            )

            .on(
                "postgres_changes",
                {
                    event: "INSERT",

                    schema: "public",

                    table: "notifications",

                    filter:
                        `user_id=eq.${userId}`
                },

                (payload) => {

                    console.log(
                        "New notification:",
                        payload.new
                    );


                    setNotifications(
                        previous => [
                            payload.new,
                            ...previous
                        ]
                    );

                }
            )

            .subscribe();


        return () => {

            supabase.removeChannel(
                channel
            );

        };

    }, [userId]);


    // ==========================================
    // MARK ONE AS READ
    // ==========================================

    async function markAsRead(
        notificationId
    ) {

        const {
            error
        } = await supabase

            .from("notifications")

            .update({
                is_read: true
            })

            .eq(
                "notification_id",
                notificationId
            );


        if (error) {

            console.log(
                "Failed to mark notification as read:",
                error
            );

            return;
        }


        setNotifications(
            previous =>

                previous.map(
                    notification =>

                        notification.notification_id ===
                        notificationId

                            ? {
                                ...notification,
                                is_read: true
                            }

                            : notification
                )
        );

    }


    // ==========================================
    // MARK ALL AS READ
    // ==========================================

    async function markAllAsRead() {

        const {
            error
        } = await supabase

            .from("notifications")

            .update({
                is_read: true
            })

            .eq(
                "user_id",
                userId
            )

            .eq(
                "is_read",
                false
            );


        if (error) {

            console.log(
                "Failed to mark all notifications as read:",
                error
            );

            return;
        }


        setNotifications(
            previous =>

                previous.map(
                    notification => ({
                        ...notification,
                        is_read: true
                    })
                )
        );

    }


    // ==========================================
    // UNREAD COUNT
    // ==========================================

    const unreadCount =
        notifications.filter(
            notification =>
                !notification.is_read
        ).length;


    return (

        <NotificationContext.Provider
            value={{

                notifications,

                loading,

                unreadCount,

                markAsRead,

                markAllAsRead

            }}
        >

            {children}

        </NotificationContext.Provider>

    );

}


// ==========================================
// CUSTOM HOOK
// ==========================================

export function useNotifications() {

    return useContext(
        NotificationContext
    );

}