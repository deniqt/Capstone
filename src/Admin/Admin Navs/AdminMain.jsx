import './adminMain.css'
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
function AdminMain(){
    const [studentCount, setStudentCount] = useState(0);
    const [recentPayments, setRecentPayments] = useState([]);
    const [tutorCount, setTutorCount] = useState(0);
    const [monthlyRevenue, setMonthlyRevenue] = useState(0);
    const [loading, setLoading] = useState(true);
    const [admin, setAdmin] = useState(null);
    
    const navigate = useNavigate();

    useEffect(() => {
       async function init() {
            setLoading(true);

            await loadDashboard();

            setLoading(false);
        }

        init();
    }, []);

    
    async function loadDashboard() {
    await Promise.all([
        getStudentCount(),
        getTutorCount(),
        getMonthlyRevenue(),
        getRecentTransactions(),
        getLoggedInAdmin()
        ]);
    }

    async function getLoggedInAdmin() {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) return;

        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("auth_id", user.id)
            .single();

        if (error) {
            console.error(error);
            return;
        }

        setAdmin(data);
    }
    async function getMonthlyRevenue() {

            const now = new Date();

            const firstDay = new Date(
                now.getFullYear(),
                now.getMonth(),
                1
            );

            const { data, error } = await supabase
                .from("payments")
                .select("amount")
                .eq("status", "Completed")
                .gte(
                    "payment_date",
                    firstDay.toISOString()
                );

            if (error) {
                console.error(error);
                return;
            }

            const total = data.reduce(
                (sum, payment) => sum + payment.amount,
                0
            );

            setMonthlyRevenue(total);
        }

    async function getTutorCount() {

            const { count, error } = await supabase
                .from("users")
                .select("*", {
                    count: "exact",
                    head: true
                })
                .eq("Role", "Tutor");

            if (error) {
                console.error(error);
                return;
            }

            setTutorCount(count);
        }

    async function getRecentTransactions() {

    const { data, error } = await supabase
        .from("payments")
        .select(`
            *,
            student:users!payments_student_id_fkey(Name)
        `)
        .order("payment_date", { ascending: false })
        .limit(9);

    if (error) {
        console.error(error);
        return;
    }

    setRecentPayments(data);
}

    async function getStudentCount() {
    const { count, error } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("Role","Student" );

    if (error) {
        console.error(error);
    } else {
         console.log(count);
        setStudentCount(count);
    }
}

    return(

        <div id='theRoot'>
        <h1 id="dashboardTitle"> Dashboard Overview</h1>
       <text id="welcomeText">
            Welcome back, <strong>{admin?.Name || "Admin"}</strong>.
            Here's what's happening today.
        </text>
        <div className="AdminDashboardNumberPanel">
            <div className='NumberBox'>
                <text>Total Students </text>
                <h1>
                    {loading ? "..." : studentCount}
                </h1>
            </div>

            <div className='NumberBox'>
                <text>Active Tutors </text>
                <h1>
                    {loading ? "..." : tutorCount}
                </h1>
            </div>

            <div className='NumberBox'>
                <text>Scheduled Sessions</text>
                <h1>Coming Soon</h1>
            </div>

            <div className='NumberBox'>
                <text>Monthly Revenue</text>
                <h1>
    {loading ? "..." :  "₱" +monthlyRevenue.toLocaleString()}</h1>
            </div>

        </div>


        <div className='AdminLowerDashboardPanel'>

            <div className='RecentTransactionPanel'>
                <div id='RecentTransactionBanner'>
                    <text style ={{
                        fontSize: "16px", fontFamily:"Inter, sans-serif", fontWeight:"500"
                    }}> Recent Transaction</text>

                   <span
                        className="viewall"
                        onClick={() => navigate("/admin/payment")}
                    >
                        View All
                    </span>
                </div>

                <table className='student-table'>
                    <thead>
                        <tr>
                            <th>Transaction ID</th>
                            <th>Student</th>
                            <th>Amount</th>
                            <th>Date</th>
                            <th>Status</th>
                        </tr>
                       
                    </thead>

                    <tbody>

                         {recentPayments.length === 0 ? (
                            <tr>
                                <td colSpan="5">
                                    No recent transactions.
                                </td>
                            </tr>
                        ) : (
                            recentPayments.map(payment => (
                               <tr key={payment.payment_id}>

                                    <td>{payment.payment_id}</td>

                                    <td>{payment.student?.Name ?? "Unknown Student"}</td>

                                    <td>
                                        ₱{payment.amount.toLocaleString()}
                                    </td>

                                    <td>
                                        {new Date(
                                            payment.payment_date
                                        ).toLocaleDateString()}
                                    </td>

                                    <td>
                                        <span
                                            className={`status ${payment.status.toLowerCase()}`}
                                        >
                                            {payment.status}
                                        </span>
                                    </td>

                                </tr>
                            ))
                        )}

                    </tbody>
                    
                </table>
            </div>

            <div className='TodaySchedulePanel'>
                <div id='RecentTransactionBanner'>
                    <text style ={{
                        fontSize: "16px", fontFamily:"Inter, sans-serif", fontWeight:"500"
                    }}> Today's Schedule</text>

                    <text className='viewall'>
                        Calendar
                    </text>
                </div>

                <table className='TodaySchedule-table'>

                    <tbody>
                        <tr>
                            <td>code</td>
                            <td>name</td>
                            <td>100</td>
                            <td>date</td>
                            <td>approve</td>
                        </tr>

                    </tbody>
                    
                </table>
            </div>

        </div>
        </div>
    );
}

export default AdminMain