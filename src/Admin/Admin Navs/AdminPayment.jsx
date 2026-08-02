import { useEffect, useState } from 'react';
import './adminPayment.css'
import { data } from 'react-router-dom';
import { supabase } from '../../lib/supabase';


function AdminPayment(){

    const [search, setSearch] = useState("");
    const[users, setUsers] = useState([]);
    const[selectedStudent, setSelectedStudent] = useState(null);
    const[admin, setAdmin] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const[paymentLists, setPaymentLists] = useState([]);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [refundReason, setRefundReason] = useState("");
    const [filter,setFilter]=useState("All");

        useEffect(() => { 
            getUsers();
            getPaymentList();
        }, []);
    
    
    async function getUsers() {
        const { data: users, error } = await supabase
        .from("users")
        .select(`
            *,
            details:user_details!users_detail_id_fkey!inner(*)
            `)
            .eq("Role", "Student");

        if (error) {
        alert("Unable to retrieve student.");
        return;
        }

        setUsers(users);

        const {
            data: { user  },
        } = await supabase.auth.getUser();

        if (!user ) return;

        const { data: LoggedAdmin, error:adminError } = await supabase
            .from("users")
            .select("*")
            .eq("auth_id", user .id)
            .single();

        if(adminError){
            return
        }

        setAdmin(LoggedAdmin)
    }

    async function getSelectedStudent(StudentID) {
        const { data: student, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", StudentID)
        .single();

        if (error) {
        alert("Unable to retrieve student.");
        return;
        }

        setSelectedStudent(student);
    }

   async function getPaymentList() {
    const { data, error } = await supabase
        .from("payments")
        .select(`
            *,
            student:users!payments_student_id_fkey(*)
        `)
        .order("payment_date", { ascending: false });

    console.log("ERROR:", error);
    console.log("DATA:", data);

    if (error) {
        console.error(error);
        return;
    }

    setPaymentLists(data);
}
    async function addPayment(){
        if (loading) return;

        setLoading(true);
        
        try{

            const today = new Date();

            if(!selectedStudent){
                alert("Select a student first.");
                return;
            }

            let subscriptionStart;

            // Case 1: First payment (NULL)
            if (!selectedStudent.Subscription_Expires) {
                subscriptionStart = today;
            }
            // Case 2: Subscription still active
            else if (new Date(selectedStudent.Subscription_Expires) > today) {
                subscriptionStart = new Date(selectedStudent.Subscription_Expires);
            }
            // Case 3: Subscription already expired
            else {
                subscriptionStart = today;
            }

            const subscriptionExpires = new Date(subscriptionStart);
            const monthsPaid = 1;

            subscriptionExpires.setMonth(
                subscriptionExpires.getMonth() + monthsPaid
            );

            const { error: paymentError } = await supabase
            .from("payments")
            .insert({
                student_id: selectedStudent.id,
                amount: 1500,
                months: 1,
                payment_date: new Date().toISOString(),
                subscription_start: subscriptionStart.toISOString(),
                subscription_expires: subscriptionExpires.toISOString(),
                admin_id: admin.id,
                status:"Completed"
            });

            if(paymentError){
                console.log(paymentError);
                return;
            }

            const { error: updateError } = await supabase
            .from("users")
            .update({
                Status: "Active",
                Subscription_Expires: subscriptionExpires
            })
            .eq("id", selectedStudent.id);

            if(updateError){
                console.log(updateError);
            }

            setShowModal(false);
            setSelectedStudent(null);
            alert("Payment added successfully.");
            getUsers();
            getPaymentList();

        }catch(err){

            console.error(err);
            alert("Something went wrong.");

        }finally {

        setLoading(false);

        }
    }

        const totalRevenue = paymentLists

        .filter(payment=>payment.status==="Completed")

        .reduce(
        (sum,payment)=>sum+payment.amount,
        0
        );


    const totalPayments = paymentLists.length;

    const successfulPayments = paymentLists.filter(
        payment => payment.status === "Completed"
    ).length;

    const successRate =
        totalPayments === 0
            ? 0
            : ((successfulPayments / totalPayments) * 100).toFixed(1);



     const latestRefundable = {};

    paymentLists
        .filter(payment => payment.status === "Completed")
        .forEach(payment => {
            const current = latestRefundable[payment.student_id];

            if (
                !current ||
                new Date(payment.subscription_expires) >
                    new Date(current.subscription_expires)
            ) {
                latestRefundable[payment.student_id] = payment;
            }
        });
        
        
    const filteredPayments = paymentLists.filter(payment => {

        const matchesFilter =
            filter === "All" ||
            payment.status === filter;

        const matchesSearch =
            payment.student.Name
                .toLowerCase()
                .includes(search.toLowerCase().trim());

        return matchesFilter && matchesSearch;

    });

    async function refundPayment(){

            if(!selectedPayment) return;

            const latestPayment = latestRefundable[selectedPayment.student_id];

            if (
                !latestPayment ||
                latestPayment.payment_id !== selectedPayment.payment_id
            ) {
                alert("Only the latest completed payment can be refunded.");
                return;
            }

            if(refundReason.trim() === ""){
                alert("Please provide a refund reason.");
                return;
            }

            setLoading(true);

            try{

                // Update payment

                const { error: paymentError } = await supabase

                .from("payments")

                .update({

                    status:"Refunded",

                    refund_date:new Date().toISOString(),

                    refund_reason:refundReason

                })

                .eq("payment_id",selectedPayment.payment_id);

                if(paymentError){

                    console.error(paymentError);

                    return;

                }

               // Get all remaining completed payments
                const { data: remainingPayments, error: remainingError } = await supabase
                    .from("payments")
                    .select("*")
                    .eq("student_id", selectedPayment.student_id)
                    .eq("status", "Completed")
                    .order("subscription_expires", { ascending: false });

                if (remainingError) {
                    console.error(remainingError);
                    return;
                }

                if (remainingPayments.length === 0) {

                    const { error } = await supabase
                        .from("users")
                        .update({
                            Status: "Inactive",
                            Subscription_Expires: null
                        })
                        .eq("id", selectedPayment.student_id);

                    if (error) {
                        console.error(error);
                        return;
                    }

                }
                else {

                const latestPayment = remainingPayments[0];

                const latestExpiry = new Date(latestPayment.subscription_expires);
                const today = new Date();

                const status =
                    latestExpiry > today
                        ? "Active"
                        : "Inactive";

               const { error: userError } = await supabase
                    .from("users")
                    .update({
                        Status: status,
                        Subscription_Expires: latestPayment.subscription_expires
                    })
                    .eq("id", selectedPayment.student_id);
                 if (userError) {
                    console.error(userError);
                    return;
                }

            }

                alert("Refund completed.");

                setShowRefundModal(false);

                setSelectedPayment(null);

                setRefundReason("");

                getUsers();

                getPaymentList();

            }

            catch(err){

                console.error(err);

            }

            finally{

                setLoading(false);

            }

        }

    return(<>


        {showModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>Material Details</h2>

                             <select
                                value={selectedStudent?.id || ""}
                                onChange={(e) => getSelectedStudent(e.target.value)}
                            >
                                <option value="">
                                    Select a Student
                                </option>
                                {users.map(user => (
                                    <option
                                        key={user.id}
                                        value={user.id}
                                    >
                                        {user.Name}
                                    </option>
                                ))}
                            </select>

                            <button  disabled={!selectedStudent} onClick={addPayment}>  {loading ? "Processing..." : "Activate User"} </button>

                        <button onClick={() => { 
                            setSelectedStudent(null);
                            setShowModal(false);
                        }}>
                            Close
                        </button>
                    </div>
                </div>
            )}


        <div className='Payment-Header'>
        <h1> ADMIN PAYMENT</h1>
        <div>
            <button className='ActiveUser-Button' onClick={()=>setShowModal(true)}>Active User</button>
        </div>
        </div>
         <div className="AdminPaymentNumberPanel">
            <div className='PaymentNumberBox'>
                <text>Total Revenue (YTR)</text>
                
                <h1>
                ₱{totalRevenue}
                </h1>
            </div>

            <div className='PaymentNumberBox'>
                <text>Success Rate</text>
                <h1>{successRate}%</h1>
            </div>

            <div className='PaymentNumberBox'>
                <text>Refunds</text>
                <h1>
                {
                paymentLists.filter(
                payment=>payment.status==="Refunded"
                ).length
                }
                </h1>
            </div>



        </div>

        <div className='AdminLowerPaymentPanel'>

            <h1 className='TransactionHistory-Title'>Transaction History</h1>
            <div className="payment-toolbar">

                <input
                    type="text"
                    placeholder="Search student..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />

                <div className="button-panel">
                <button
                    className={filter === "All" ? "active-filter" : ""}
                    onClick={() => setFilter("All")}
                >
                    All
                </button>

                <button
                    className={filter === "Completed" ? "active-filter" : ""}
                    onClick={() => setFilter("Completed")}
                >
                    Completed
                </button>

                <button
                    className={filter === "Failed" ? "active-filter" : ""}
                    onClick={() => setFilter("Failed")}
                >
                    Failed
                </button>

                <button
                    className={filter === "Refunded" ? "active-filter" : ""}
                    onClick={() => setFilter("Refunded")}
                >
                    Refunded
                </button>
                    
                </div>
            </div>
            <div>
                <div className='mainTable'>
                    <table className='user-table'>

                        <thead>
                            <tr>
                                <th>Transaction ID</th>
                                <th>Student</th>
                                <th>Amount</th>
                                <th>Date</th>
                                <th>Payment Method</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>

                        <tbody>
                            {
                                filteredPayments.map((payment) => 
                                (
                                    <tr key={payment.payment_id}>
                                        <td>{payment.payment_id}</td>
                                        <td>{payment.student.Name}</td>
                                        <td>{payment.amount}</td>
                                        <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                                        <td>Gcash Muna</td>
                                        <td>
                                            <span className={`status ${payment.status.toLowerCase()}`}>
                                            {payment.status}
                                            </span>
                                        </td>
                                        <td>
                                            {payment.status === "Completed" &&
                                            latestRefundable[payment.student_id]?.payment_id === payment.payment_id ? (

                                                <button
                                                    onClick={() => {
                                                        setSelectedPayment(payment);
                                                        setRefundReason("");
                                                        setShowRefundModal(true);
                                                    }}
                                                >
                                                    Refund
                                                </button>

                                            ) : (

                                               <button disabled>

                                                {
                                                payment.status === "Completed"
                                                    ? "Cannot Refund"
                                                    : payment.status
                                                }

                                                </button>

                                            )}

                                        </td>
                                    </tr>
                                )
                                )
                            }
                        
                        </tbody>
                    </table>
                </div>
            </div>
        </div>


        {
            showRefundModal && (

            <div className="modal-overlay">

                <div className="modal">

                    <h2>Refund Payment</h2>

                    <p>
                        Student:
                        <strong>
                            {selectedPayment?.student.Name}
                        </strong>
                    </p>

                    <p>
                        Amount:
                        <strong>
                            ₱{selectedPayment?.amount}
                        </strong>
                    </p>

                    <textarea

                        placeholder="Reason for refund"

                        value={refundReason}

                        onChange={(e)=>setRefundReason(e.target.value)}

                    />

                    <button
                        disabled={loading}
                        onClick={refundPayment}
                    >
                        {loading ? "Refunding..." : "Confirm Refund"}
                    </button>

                    <button
                        onClick={()=>{
                            setShowRefundModal(false);
                            setSelectedPayment(null);
                        }}
                    >
                        Cancel
                    </button>

                </div>

            </div>

            )
            }
    </>);
}

export default AdminPayment