import { useEffect, useState, useMemo } from 'react';
import './adminPayment.css';
import { supabase } from '../../lib/supabase';
import { createNotification } from '../../Services/notificationService';
import {
    getMerchandiseList,
    saveMerchandiseItem,
    restockMerchandise,
    decrementMerchandiseStock,
    deleteMerchandiseItem
} from '../../Services/merchandiseService';

// Academic Tutoring Services (separated from physical merchandise)
const ACADEMIC_SERVICES = [
    { label: "Hourly Tutoring", price: 200, category: "Academic Tutoring" },
    { label: "Reading Sessions", price: 3500, category: "Literacy & Reading" },
    { label: "Diagnostic Assessment", price: 500, category: "Assessment & Testing" },
];

// Preserved for backwards compatibility with any existing lookups
const SALE_ITEMS = [
    ...ACADEMIC_SERVICES,
    { label: "Notebooks", price: 80, category: "Merchandise" },
    { label: "T-shirt", price: 300, category: "Merchandise" }
];

const CUSTOM_ITEM = "Custom";

// Storage bucket where students upload their proof of payment
const PROOF_BUCKET = "renewal-proofs";

// Price of one month of subscription (same value used by "Active User")
const MONTHLY_PRICE = 3200;

function AdminPayment(){

    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [search, setSearch] = useState("");
    const[users, setUsers] = useState([]);
    const[selectedStudent, setSelectedStudent] = useState(null);
    const[admin, setAdmin] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const[paymentLists, setPaymentLists] = useState([]);
    const [selectedPayment, setSelectedPayment] = useState(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("CASH");
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [refundReason, setRefundReason] = useState("");
    const [filter,setFilter]=useState("All");
    const [studentSearch, setStudentSearch] = useState("");
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [paymentToDelete, setPaymentToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Main Navigation Tab: "subscriptions" | "merchandise"
    const [paymentTab, setPaymentTab] = useState("subscriptions");

    // Add Sales modal state
    const [showSaleModal, setShowSaleModal] = useState(false);
    const [saleCategory, setSaleCategory] = useState("academic"); // "academic" | "merchandise" | "custom"
    const [saleName, setSaleName] = useState("");
    const [saleService, setSaleService] = useState("");
    const [salePrice, setSalePrice] = useState("");
    const [saleMethod, setSaleMethod] = useState("CASH");
    const [savingSale, setSavingSale] = useState(false);

    const [saleItem, setSaleItem] = useState("");
    const [saleQuantity, setSaleQuantity] = useState(1);

    // Merchandise Catalog & Inventory State
    const [merchandiseList, setMerchandiseList] = useState([]);
    const [merchSearch, setMerchSearch] = useState("");
    const [merchCategoryFilter, setMerchCategoryFilter] = useState("All");

    // Merchandise Modals
    const [showAddMerchModal, setShowAddMerchModal] = useState(false);
    const [editingMerchItem, setEditingMerchItem] = useState(null);
    const [merchForm, setMerchForm] = useState({
        name: "",
        category: "Apparel",
        size: "",
        price: "",
        stock: "",
        description: ""
    });

    const [showRestockModal, setShowRestockModal] = useState(false);
    const [restockTarget, setRestockTarget] = useState(null);
    const [restockAmount, setRestockAmount] = useState(10);

    const [showQuickSellModal, setShowQuickSellModal] = useState(false);
    const [quickSellItem, setQuickSellItem] = useState(null);
    const [quickSellCustomer, setQuickSellCustomer] = useState("");
    const [quickSellQty, setQuickSellQty] = useState(1);
    const [quickSellMethod, setQuickSellMethod] = useState("CASH");
    const [quickSelling, setQuickSelling] = useState(false);

    // Derived sale values (recalculate on every render, so the total updates live)
    const isCustomSale = saleCategory === "custom" || saleItem === CUSTOM_ITEM;
    const selectedAcademic = ACADEMIC_SERVICES.find(item => item.label === saleItem);
    const selectedMerch = merchandiseList.find(item => item.name === saleItem || item.id === saleItem);

    const saleUnitPrice = isCustomSale
        ? Number(salePrice) || 0
        : selectedAcademic
        ? selectedAcademic.price
        : selectedMerch
        ? selectedMerch.price
        : (SALE_ITEMS.find(item => item.label === saleItem)?.price || 0);

    const saleQty = Math.max(1, parseInt(saleQuantity, 10) || 1);
    const saleTotal = saleUnitPrice * saleQty;

    // Renewal requests
    const [requests, setRequests] = useState([]);
    const [proofUrls, setProofUrls] = useState({});
    const [requestFilter, setRequestFilter] = useState("Pending");
    const [requestSearch, setRequestSearch] = useState("");
    const [reviewRequest, setReviewRequest] = useState(null);
    const [reviewMethod, setReviewMethod] = useState("GCASH");
    const [reviewNote, setReviewNote] = useState("");
    const [reviewing, setReviewing] = useState(false);

        useEffect(() => { 
            getUsers();
            getPaymentList();
            getRenewalRequests();
            setMerchandiseList(getMerchandiseList());
        }, []);
    
    
    async function getUsers() {
        const { data: users, error } = await supabase
        .from("users")
        .select(`
            *,
            details:user_details!users_detail_id_fkey!inner(*)
            `)
            .eq("Role", "Student")
            .order("id", { ascending: false }); // newest students first

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
        // Clearing the dropdown back to "Select a Student"
        if (!StudentID) {
            setSelectedStudent(null);
            return;
        }

        const { data: student, error } = await supabase
        .from("users")
        .select(`
            *,
            details:user_details!users_detail_id_fkey(*)
        `)
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

    // ==========================================
    // RENEWAL REQUESTS
    // ==========================================

    async function getRenewalRequests() {
        const { data, error } = await supabase
            .from("renewal_requests")
            .select(`
                *,
                student:users!renewal_requests_student_id_fkey(*)
            `)
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Renewal requests error:", error);
            return;
        }

        const list = data || [];
        setRequests(list);

        // Signed URLs so proofs also work when the bucket is private
        const paths = list.map(r => r.proof_path).filter(Boolean);

        if (paths.length === 0) {
            setProofUrls({});
            return;
        }

        const { data: signed, error: signError } = await supabase.storage
            .from(PROOF_BUCKET)
            .createSignedUrls(paths, 60 * 60);

        if (signError) {
            console.error("Proof URL error:", signError);
            return;
        }

        const map = {};
        (signed || []).forEach(item => {
            if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
        });
        setProofUrls(map);
    }

    function openReview(request){
        setReviewRequest(request);
        setReviewMethod("GCASH");
        setReviewNote("");
    }

    function closeReview(){
        if (reviewing) return;
        setReviewRequest(null);
        setReviewNote("");
    }

    async function notifyStudent(request, approved, note){
        try{
            await createNotification({
                userId: request.student_id,
                title: approved ? "Renewal approved" : "Renewal rejected",
                message: approved
                    ? `Your ${request.months}-month renewal was approved. Your subscription has been extended.`
                    : `Your renewal request was rejected. Reason: ${note}`,
                type: "payment",
                relatedTable: "renewal_requests",
                relatedId: request.request_id,
                actionUrl: "/student/subscription"
            });
        }catch(err){
            console.log("Student notification error:", err);
        }
    }

    async function approveRequest(){
        if (!reviewRequest || reviewing) return;

        if (!admin) {
            alert("Unable to identify the logged-in admin. Please refresh and try again.");
            return;
        }

        setReviewing(true);

        try{

            // Re-read the student so we extend from the freshest expiry date
            const { data: student, error: studentError } = await supabase
                .from("users")
                .select("id, Subscription_Expires")
                .eq("id", reviewRequest.student_id)
                .single();

            if (studentError) {
                console.error(studentError);
                alert("Unable to load the student.");
                return;
            }

            const today = new Date();
            const months = reviewRequest.months || 1;

            // Extend from the later of (current expiry, today)
            const subscriptionStart =
                student.Subscription_Expires && new Date(student.Subscription_Expires) > today
                    ? new Date(student.Subscription_Expires)
                    : today;

            const subscriptionExpires = new Date(subscriptionStart);
            subscriptionExpires.setMonth(subscriptionExpires.getMonth() + months);

            // 1. Record the payment
            const { error: paymentError } = await supabase
                .from("payments")
                .insert({
                    student_id: student.id,
                    amount: MONTHLY_PRICE * months,
                    months: months,
                    payment_date: today.toISOString(),
                    subscription_start: subscriptionStart.toISOString(),
                    subscription_expires: subscriptionExpires.toISOString(),
                    admin_id: admin.id,
                    status: "Completed",
                    method: reviewMethod,
                    remarks: `Renewal request #${reviewRequest.request_id}`
                });

            if (paymentError) {
                console.error(paymentError);
                alert("Unable to record the payment: " + paymentError.message);
                return;
            }

            // 2. Activate / extend the student
            const { error: userError } = await supabase
                .from("users")
                .update({
                    Status: "Active",
                    Subscription_Expires: subscriptionExpires.toISOString()
                })
                .eq("id", student.id);

            if (userError) {
                console.error(userError);
                alert("Payment saved, but the student could not be updated: " + userError.message);
                return;
            }

            // 3. Close the request
            const { error: requestError } = await supabase
                .from("renewal_requests")
                .update({
                    status: "Approved",
                    admin_id: admin.id,
                    admin_note: reviewNote.trim() || null,
                    reviewed_at: today.toISOString()
                })
                .eq("request_id", reviewRequest.request_id);

            if (requestError) {
                console.error(requestError);
                alert("Payment saved, but the request could not be updated: " + requestError.message);
                return;
            }

            await notifyStudent(reviewRequest, true, "");

            setReviewRequest(null);
            setReviewNote("");
            alert("Renewal approved.");

            getUsers();
            getPaymentList();
            getRenewalRequests();

        }catch(err){

            console.error(err);
            alert("Something went wrong.");

        }finally{

            setReviewing(false);

        }
    }

    async function rejectRequest(){
        if (!reviewRequest || reviewing) return;

        if (reviewNote.trim() === "") {
            alert("Please provide a reason for rejecting this request.");
            return;
        }

        if (!admin) {
            alert("Unable to identify the logged-in admin. Please refresh and try again.");
            return;
        }

        setReviewing(true);

        try{

            const { error } = await supabase
                .from("renewal_requests")
                .update({
                    status: "Rejected",
                    admin_id: admin.id,
                    admin_note: reviewNote.trim(),
                    reviewed_at: new Date().toISOString()
                })
                .eq("request_id", reviewRequest.request_id);

            if (error) {
                console.error(error);
                alert("Unable to reject the request: " + error.message);
                return;
            }

            await notifyStudent(reviewRequest, false, reviewNote.trim());

            setReviewRequest(null);
            setReviewNote("");
            alert("Renewal request rejected.");

            getRenewalRequests();

        }catch(err){

            console.error(err);
            alert("Something went wrong.");

        }finally{

            setReviewing(false);

        }
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
                amount: 3200,
                months: 1,
                payment_date: new Date().toISOString(),
                subscription_start: subscriptionStart.toISOString(),
                subscription_expires: subscriptionExpires.toISOString(),
                admin_id: admin.id,
                status:"Completed",
                method:selectedPaymentMethod
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
            setStudentSearch("");
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

    // Records a one-off sale (not tied to a student subscription).
    // It does NOT touch the users table, so nobody gets activated.
    async function addSale(){
        if (savingSale) return;

        if (!saleName.trim()) {
            alert("Please enter a name.");
            return;
        }

        if (!saleItem) {
            alert("Please select an item.");
            return;
        }

        if (isCustomSale && !saleService.trim()) {
            alert("Please enter the service title.");
            return;
        }

        if (!saleUnitPrice || saleUnitPrice <= 0) {
            alert("Please enter a valid price.");
            return;
        }

        if (!Number.isInteger(Number(saleQuantity)) || Number(saleQuantity) < 1) {
            alert("Quantity must be a whole number of at least 1.");
            return;
        }

        if (!admin) {
            alert("Unable to identify the logged-in admin. Please refresh and try again.");
            return;
        }

        const serviceTitle = isCustomSale ? saleService.trim() : saleItem;

        setSavingSale(true);

        try{

            const { error } = await supabase
                .from("payments")
                .insert({
                    student_id: null,
                    customer_name: saleName.trim(),
                    // e.g. "Notebooks (x3)" so the quantity shows in Transaction History
                    service: saleQty > 1 ? `${serviceTitle} (x${saleQty})` : serviceTitle,
                    amount: saleTotal,
                    months: 0,
                    payment_date: new Date().toISOString(),
                    admin_id: admin.id,
                    status: "Completed",
                    method: saleMethod
                });

            if (error) {
                console.error(error);
                alert("Unable to save sale: " + error.message);
                return;
            }

            // Decrement merchandise stock if an inventory item was sold
            if (selectedMerch) {
                decrementMerchandiseStock(selectedMerch.id, saleQty);
                setMerchandiseList(getMerchandiseList());
            }

            closeSaleModal();
            alert("Sale added successfully.");
            getPaymentList();

        }catch(err){

            console.error(err);
            alert("Something went wrong.");

        }finally{

            setSavingSale(false);

        }
    }

    function closeSaleModal(){
        setShowSaleModal(false);
        setSaleCategory("academic");
        setSaleName("");
        setSaleItem("");
        setSaleService("");
        setSalePrice("");
        setSaleQuantity(1);
        setSaleMethod("CASH");
    }

    // ==========================================
    // MERCHANDISE INVENTORY HANDLERS
    // ==========================================

    function openAddMerchModal(item = null) {
        if (item) {
            setEditingMerchItem(item);
            setMerchForm({
                name: item.name,
                category: item.category || "Apparel",
                size: item.size || "",
                price: item.price,
                stock: item.stock,
                description: item.description || ""
            });
        } else {
            setEditingMerchItem(null);
            setMerchForm({
                name: "",
                category: "Apparel",
                size: "",
                price: "300",
                stock: "20",
                description: ""
            });
        }
        setShowAddMerchModal(true);
    }

    function handleSaveMerchItem() {
        if (!merchForm.name.trim()) {
            alert("Please enter a product name.");
            return;
        }
        if (!merchForm.price || Number(merchForm.price) < 0) {
            alert("Please enter a valid price.");
            return;
        }
        if (merchForm.stock === "" || Number(merchForm.stock) < 0) {
            alert("Please enter a valid stock count.");
            return;
        }

        saveMerchandiseItem({
            ...(editingMerchItem ? { id: editingMerchItem.id } : {}),
            name: merchForm.name.trim(),
            category: merchForm.category,
            size: (merchForm.size || "").trim() || null,
            price: Number(merchForm.price),
            stock: parseInt(merchForm.stock, 10),
            description: merchForm.description.trim()
        });

        setMerchandiseList(getMerchandiseList());
        setShowAddMerchModal(false);
        alert(editingMerchItem ? "Product updated successfully." : "New product added to catalog.");
    }

    function handleDeleteMerchItem(id, name) {
        if (window.confirm(`Are you sure you want to remove "${name}" from the catalog?`)) {
            deleteMerchandiseItem(id);
            setMerchandiseList(getMerchandiseList());
        }
    }

    function handleRestockSubmit() {
        if (!restockTarget) return;
        const qty = parseInt(restockAmount, 10);
        if (!qty || qty <= 0) {
            alert("Please enter a positive quantity to add.");
            return;
        }

        restockMerchandise(restockTarget.id, qty);
        setMerchandiseList(getMerchandiseList());
        setShowRestockModal(false);
        alert(`Restocked ${qty} units of ${restockTarget.name}.`);
    }

    async function handleQuickSellSubmit() {
        if (!quickSellItem) return;
        if (!quickSellCustomer.trim()) {
            alert("Please enter a customer or student name.");
            return;
        }
        const qty = parseInt(quickSellQty, 10);
        if (!qty || qty <= 0) {
            alert("Quantity must be at least 1.");
            return;
        }
        if (qty > (quickSellItem.stock || 0)) {
            alert(`Cannot sell ${qty} units. Only ${quickSellItem.stock || 0} in stock.`);
            return;
        }
        if (!admin) {
            alert("Admin not recognized. Please refresh.");
            return;
        }

        setQuickSelling(true);
        const total = quickSellItem.price * qty;

        try {
            const { error } = await supabase
                .from("payments")
                .insert({
                    student_id: null,
                    customer_name: quickSellCustomer.trim(),
                    service: qty > 1 ? `${quickSellItem.name} (x${qty})` : quickSellItem.name,
                    amount: total,
                    months: 0,
                    payment_date: new Date().toISOString(),
                    admin_id: admin.id,
                    status: "Completed",
                    method: quickSellMethod
                });

            if (error) {
                console.error(error);
                alert("Failed to record merchandise sale: " + error.message);
                return;
            }

            decrementMerchandiseStock(quickSellItem.id, qty);
            setMerchandiseList(getMerchandiseList());
            getPaymentList();
            setShowQuickSellModal(false);
            alert(`Successfully sold ${qty}x ${quickSellItem.name} for ₱${total.toLocaleString()}.`);
        } catch (err) {
            console.error(err);
            alert("Something went wrong recording the sale.");
        } finally {
            setQuickSelling(false);
        }
    }

    function getUnitsSold(item) {
        const sLower = item.name.toLowerCase();
        const itemSize = (item.size || "").toLowerCase();
        let total = 0;
        paymentLists.forEach(p => {
            if (p.status !== "Completed" || !p.service) return;
            const pLower = p.service.toLowerCase();
            
            let isMatch = false;
            if (pLower.includes(sLower)) {
                isMatch = true;
            } else if (itemSize && (pLower.includes("shirt") || pLower.includes("t-shirt"))) {
                // If payment mentions a specific size
                const sizeMatch = pLower.match(/\b(xs|xl|2xl|s|m|l)\b/i);
                if (sizeMatch) {
                    if (sizeMatch[1].toLowerCase() === itemSize) {
                        isMatch = true;
                    }
                } else if (itemSize === "m") {
                    // Attribute legacy un-sized "T-shirt" sales to Medium
                    isMatch = true;
                }
            } else if (sLower.includes("notebook") && pLower.includes("notebook")) {
                isMatch = true;
            }

            if (isMatch) {
                const match = p.service.match(/\(x(\d+)\)/);
                total += match ? parseInt(match[1], 10) : 1;
            }
        });
        return total;
    }

    // Merchandise Analytics
    const totalMerchRevenue = useMemo(() => {
        return paymentLists
            .filter(p => p.status === "Completed")
            .reduce((sum, p) => {
                const sLower = (p.service || "").toLowerCase();
                const isMerch = merchandiseList.some(m => sLower.includes(m.name.toLowerCase())) ||
                    sLower.includes("t-shirt") || sLower.includes("shirt") || sLower.includes("notebook");
                return isMerch ? sum + Number(p.amount || 0) : sum;
            }, 0);
    }, [paymentLists, merchandiseList]);

    const totalStockUnits = useMemo(() => {
        return merchandiseList.reduce((sum, m) => sum + (Number(m.stock) || 0), 0);
    }, [merchandiseList]);

    const lowStockCount = useMemo(() => {
        return merchandiseList.filter(m => (Number(m.stock) || 0) <= 10).length;
    }, [merchandiseList]);

    const filteredMerchandise = useMemo(() => {
        return merchandiseList.filter(item => {
            const matchesCat = merchCategoryFilter === "All" || item.category === merchCategoryFilter;
            const matchesSearch = !merchSearch.trim() ||
                item.name.toLowerCase().includes(merchSearch.toLowerCase()) ||
                (item.description && item.description.toLowerCase().includes(merchSearch.toLowerCase()));
            return matchesCat && matchesSearch;
        });
    }, [merchandiseList, merchCategoryFilter, merchSearch]);
    // A payment is either a student subscription (has a student) or a
    // walk-in sale (has customer_name instead).
    function getPaymentName(payment){
        return payment.student?.Name || payment.customer_name || "Walk-in";
    }

    const pendingRequestCount = requests.filter(r => r.status === "Pending").length;

    const filteredRequests = requests.filter(request => {

        const matchesFilter =
            requestFilter === "All" ||
            request.status === requestFilter;

        const matchesSearch =
            (request.student?.Name || "")
                .toLowerCase()
                .includes(requestSearch.toLowerCase().trim());

        return matchesFilter && matchesSearch;

    });

    const totalRevenue = paymentLists

        .filter(payment=>payment.status==="Completed")

        .reduce(
        (sum,payment)=>sum+Number(payment.amount),
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
        .filter(payment => payment.status === "Completed" && payment.student_id)
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
            getPaymentName(payment)
                .toLowerCase()
                .includes(search.toLowerCase().trim());

        return matchesFilter && matchesSearch;

    });

    // Students shown in the "Active User" modal's picker, filtered by the
    // modal's own search box. `users` is already ordered newest-first from
    // getUsers(), so this preserves that order.
    const filteredStudentOptions = users.filter(user =>
        user.Name.toLowerCase().includes(studentSearch.toLowerCase().trim())
    );

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

    async function deletePayment(){

        if(!paymentToDelete) return;

        setDeleting(true);

        try{

            const { error: deleteError } = await supabase
                .from("payments")
                .delete()
                .eq("payment_id", paymentToDelete.payment_id);

            if(deleteError){
                console.error(deleteError);
                alert("Unable to delete transaction.");
                return;
            }

            // Walk-in sales have no student, so there is no subscription
            // status to recalculate.
            if (paymentToDelete.student_id) {

                // Recalculate the student's subscription status now that this
                // payment is gone, the same way a refund does.
                const { data: remainingPayments, error: remainingError } = await supabase
                    .from("payments")
                    .select("*")
                    .eq("student_id", paymentToDelete.student_id)
                    .eq("status", "Completed")
                    .order("subscription_expires", { ascending: false });

                if (remainingError) {
                    console.error(remainingError);
                } else if (remainingPayments.length === 0) {

                    const { error } = await supabase
                        .from("users")
                        .update({
                            Status: "Inactive",
                            Subscription_Expires: null
                        })
                        .eq("id", paymentToDelete.student_id);

                    if (error) console.error(error);

                } else {

                    const latestPayment = remainingPayments[0];
                    const latestExpiry = new Date(latestPayment.subscription_expires);
                    const today = new Date();

                    const status = latestExpiry > today ? "Active" : "Inactive";

                    const { error: userError } = await supabase
                        .from("users")
                        .update({
                            Status: status,
                            Subscription_Expires: latestPayment.subscription_expires
                        })
                        .eq("id", paymentToDelete.student_id);

                    if (userError) console.error(userError);

                }

            }

            alert("Transaction deleted.");

            setShowDeleteModal(false);
            setPaymentToDelete(null);

            getUsers();
            getPaymentList();

        }catch(err){

            console.error(err);
            alert("Something went wrong.");

        }finally{

            setDeleting(false);

        }
    }

    return(<>


        {showModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h2>Material Details</h2>


                            <div className="student-combobox">
                                <input
                                    type="text"
                                    className="student-search-input"
                                    placeholder="Search or select a student..."
                                    autoComplete="off"
                                    value={dropdownOpen ? studentSearch : (selectedStudent?.Name || "")}
                                    onFocus={() => {
                                        setStudentSearch("");      // show the full list when opened
                                        setDropdownOpen(true);
                                    }}
                                    onChange={(e) => {
                                        setStudentSearch(e.target.value);
                                        setDropdownOpen(true);
                                        // typing means they're picking someone new, so clear the old pick
                                        if (selectedStudent) setSelectedStudent(null);
                                    }}
                                    onBlur={() => setDropdownOpen(false)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Escape") setDropdownOpen(false);
                                        if (e.key === "Enter" && filteredStudentOptions.length > 0) {
                                            e.preventDefault();
                                            getSelectedStudent(filteredStudentOptions[0].id);
                                            setDropdownOpen(false);
                                        }
                                    }}
                                />

                                {dropdownOpen && (
                                    <ul
                                        className="student-combobox-list"
                                        onMouseDown={(e) => e.preventDefault()}  // keeps the input from blurring before the click registers
                                    >
                                        {filteredStudentOptions.length === 0 ? (
                                            <li className="student-combobox-empty">No students found</li>
                                        ) : (
                                            filteredStudentOptions.map((user) => (
                                                <li
                                                    key={user.id}
                                                    className={`student-combobox-item ${
                                                        selectedStudent?.id === user.id ? "selected" : ""
                                                    }`}
                                                    onClick={() => {
                                                        getSelectedStudent(user.id);
                                                        setDropdownOpen(false);
                                                    }}
                                                >
                                                    {user.Name}
                                                </li>
                                            ))
                                        )}
                                    </ul>
                                )}
                            </div>

                            {selectedStudent && (
                                <div className="student-documents">

                                    {selectedStudent.details?.Guardian_ID_URL ? (
                                        <a
                                            href={selectedStudent.details.Guardian_ID_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Parent ID
                                        </a>
                                    ) : (
                                        <span className="document-missing">Parent ID (not provided)</span>
                                    )}

                                    {selectedStudent.details?.Certificate_URL ? (
                                        <a
                                            href={selectedStudent.details.Certificate_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Certificates/proof
                                        </a>
                                    ) : (
                                        <span className="document-missing">Certificates/proof (not provided)</span>
                                    )}

                                </div>
                            )}

                            <select value = {selectedPaymentMethod||"CASH"}
                                    onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                                >
                                <option value="CASH">CASH</option>
                                <option value="PAY MAYA">PAY MAYA</option>
                                <option value="GCASH">GCASH</option>
                            </select>

                            <div className="modal-buttons">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => {
                                        setSelectedStudent(null);
                                        setStudentSearch("");
                                        setDropdownOpen(false);
                                        setShowModal(false);
                                    }}
                                >
                                    Close
                                </button>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    disabled={!selectedStudent || loading}
                                    onClick={addPayment}
                                >
                                    {loading ? "Processing..." : "Activate User"}
                                </button>
                            </div>
                    </div>
                </div>
            )}

        {showSaleModal && (
            <div className="modal-overlay">
                <div className="modal add-sale-modal-enhanced">
                    <h2>Add Sales & Services</h2>

                    {/* Category Selection Tabs (Separating Academic Services from Merchandise) */}
                    <div className="sale-category-toggle">
                        <button
                            type="button"
                            className={`sale-cat-btn ${saleCategory === "academic" ? "active" : ""}`}
                            onClick={() => { setSaleCategory("academic"); setSaleItem(""); }}
                        >
                            🎓 Academic Services
                        </button>
                        <button
                            type="button"
                            className={`sale-cat-btn ${saleCategory === "merchandise" ? "active" : ""}`}
                            onClick={() => { setSaleCategory("merchandise"); setSaleItem(""); }}
                        >
                            🛍️ Merchandise Catalog
                        </button>
                        <button
                            type="button"
                            className={`sale-cat-btn ${saleCategory === "custom" ? "active" : ""}`}
                            onClick={() => { setSaleCategory("custom"); setSaleItem(CUSTOM_ITEM); }}
                        >
                            ✏️ Custom
                        </button>
                    </div>

                    <input
                        type="text"
                        placeholder="Customer / Student Name"
                        value={saleName}
                        onChange={(e) => setSaleName(e.target.value)}
                    />

                    {saleCategory === "academic" && (
                        <select
                            value={saleItem}
                            onChange={(e) => setSaleItem(e.target.value)}
                        >
                            <option value="">Select an academic service</option>
                            {ACADEMIC_SERVICES.map(item => (
                                <option key={item.label} value={item.label}>
                                    {item.label} - ₱{item.price.toLocaleString()}
                                </option>
                            ))}
                        </select>
                    )}

                    {saleCategory === "merchandise" && (
                        <select
                            value={saleItem}
                            onChange={(e) => setSaleItem(e.target.value)}
                        >
                            <option value="">Select physical merchandise</option>
                            {merchandiseList.map(item => (
                                <option
                                    key={item.id}
                                    value={item.name}
                                    disabled={item.stock <= 0}
                                >
                                    {item.name} - ₱{item.price.toLocaleString()} ({item.stock > 0 ? `${item.stock} in stock` : "Out of stock"})
                                </option>
                            ))}
                        </select>
                    )}

                    {isCustomSale && (
                        <>
                            <input
                                type="text"
                                placeholder="Service title (e.g. Assessment, Study Pack)"
                                value={saleService}
                                onChange={(e) => setSaleService(e.target.value)}
                            />

                            <input
                                type="number"
                                min="0"
                                placeholder="Price per unit (PHP)"
                                value={salePrice}
                                onChange={(e) => setSalePrice(e.target.value)}
                            />
                        </>
                    )}

                    {saleItem && (
                        <>
                            <div className="sale-quantity">
                                <span>Quantity {selectedMerch && `(Max ${selectedMerch.stock})`}</span>

                                <div className="sale-quantity-controls">
                                    <button
                                        type="button"
                                        onClick={() => setSaleQuantity(Math.max(1, saleQty - 1))}
                                    >
                                        −
                                    </button>

                                    <input
                                        type="number"
                                        min="1"
                                        max={selectedMerch ? selectedMerch.stock : undefined}
                                        step="1"
                                        value={saleQuantity}
                                        onChange={(e) => setSaleQuantity(e.target.value)}
                                        onBlur={() => setSaleQuantity(saleQty)}
                                    />

                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (selectedMerch && saleQty >= selectedMerch.stock) {
                                                alert(`Only ${selectedMerch.stock} units available in stock.`);
                                                return;
                                            }
                                            setSaleQuantity(saleQty + 1);
                                        }}
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            <div className="sale-total">
                                <span>
                                    ₱{saleUnitPrice.toLocaleString()} × {saleQty}
                                </span>
                                <strong>₱{saleTotal.toLocaleString()}</strong>
                            </div>
                        </>
                    )}

                    <select
                        value={saleMethod}
                        onChange={(e) => setSaleMethod(e.target.value)}
                    >
                        <option value="CASH">CASH</option>
                        <option value="PAY MAYA">PAY MAYA</option>
                        <option value="GCASH">GCASH</option>
                    </select>

                    <div className="modal-buttons">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={closeSaleModal}
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            className="btn-primary"
                            disabled={savingSale || !saleItem}
                            onClick={addSale}
                        >
                            {savingSale ? "Saving..." : "Add Sale"}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ==========================================
            MERCHANDISE MODAL: QUICK SELL ITEM
        ========================================== */}
        {showQuickSellModal && quickSellItem && (
            <div className="modal-overlay">
                <div className="modal quick-sell-modal">
                    <h2>Sell Merchandise Item</h2>
                    <div style={{ marginBottom: "12px" }}>
                        <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155", display: "block", marginBottom: "4px" }}>
                            Select Product & Size
                        </label>
                        <select
                            value={quickSellItem.id}
                            onChange={(e) => {
                                const found = merchandiseList.find(m => m.id === e.target.value);
                                if (found) {
                                    setQuickSellItem(found);
                                    setQuickSellQty(1);
                                }
                            }}
                        >
                            {merchandiseList.map(item => (
                                <option key={item.id} value={item.id} disabled={item.stock <= 0}>
                                    {item.name} {item.size ? `[Size ${item.size}]` : ""} — ₱{item.price.toLocaleString()} ({item.stock > 0 ? `${item.stock} in stock` : "Out of stock"})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="quick-sell-item-summary">
                        <div className="quick-sell-name">
                            {quickSellItem.name}
                            {quickSellItem.size && <span className="merch-size-badge" style={{ marginLeft: "8px" }}>Size: {quickSellItem.size}</span>}
                        </div>
                        <div className="quick-sell-price">₱{quickSellItem.price.toLocaleString()} each</div>
                        <span className={`stock-pill ${quickSellItem.stock > 10 ? "in-stock" : quickSellItem.stock > 0 ? "low-stock" : "out-of-stock"}`}>
                            {quickSellItem.stock > 0 ? `${quickSellItem.stock} in stock` : "Out of stock"}
                        </span>
                    </div>

                    <input
                        type="text"
                        placeholder="Customer / Student Name"
                        value={quickSellCustomer}
                        onChange={(e) => setQuickSellCustomer(e.target.value)}
                    />

                    <div className="sale-quantity">
                        <span>Quantity (Max: {quickSellItem.stock})</span>
                        <div className="sale-quantity-controls">
                            <button
                                type="button"
                                onClick={() => setQuickSellQty(Math.max(1, quickSellQty - 1))}
                            >
                                −
                            </button>
                            <input
                                type="number"
                                min="1"
                                max={quickSellItem.stock}
                                value={quickSellQty}
                                onChange={(e) => setQuickSellQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            />
                            <button
                                type="button"
                                onClick={() => setQuickSellQty(Math.min(quickSellItem.stock, quickSellQty + 1))}
                                disabled={quickSellQty >= quickSellItem.stock}
                            >
                                +
                            </button>
                        </div>
                    </div>

                    <div className="sale-total">
                        <span>₱{quickSellItem.price.toLocaleString()} × {quickSellQty}</span>
                        <strong>₱{(quickSellItem.price * quickSellQty).toLocaleString()}</strong>
                    </div>

                    <select
                        value={quickSellMethod}
                        onChange={(e) => setQuickSellMethod(e.target.value)}
                    >
                        <option value="CASH">CASH</option>
                        <option value="PAY MAYA">PAY MAYA</option>
                        <option value="GCASH">GCASH</option>
                    </select>

                    <div className="modal-buttons">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setShowQuickSellModal(false)}
                            disabled={quickSelling}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn-primary"
                            disabled={quickSelling || !quickSellCustomer.trim() || quickSellItem.stock <= 0}
                            onClick={handleQuickSellSubmit}
                        >
                            {quickSelling ? "Recording..." : "Confirm & Record Sale"}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ==========================================
            MERCHANDISE MODAL: RESTOCK QUANTITY
        ========================================== */}
        {showRestockModal && restockTarget && (
            <div className="modal-overlay">
                <div className="modal restock-modal">
                    <h2>Restock Inventory</h2>
                    <p style={{ margin: "4px 0 16px", color: "#64748b", fontSize: "0.88rem" }}>
                        Adding units for <strong>{restockTarget.name}</strong> (Current Stock: {restockTarget.stock})
                    </p>

                    <label style={{ fontSize: "0.84rem", fontWeight: 600, color: "#334155" }}>
                        Units to Add:
                    </label>
                    <input
                        type="number"
                        min="1"
                        step="1"
                        value={restockAmount}
                        onChange={(e) => setRestockAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    />

                    <div className="restock-quick-pills">
                        {[5, 10, 25, 50, 100].map(amt => (
                            <button
                                key={amt}
                                type="button"
                                className="restock-pill-btn"
                                onClick={() => setRestockAmount(amt)}
                            >
                                +{amt}
                            </button>
                        ))}
                    </div>

                    <div className="restock-preview">
                        New Stock Level: <strong>{(restockTarget.stock || 0) + (parseInt(restockAmount, 10) || 0)} units</strong>
                    </div>

                    <div className="modal-buttons">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setShowRestockModal(false)}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={handleRestockSubmit}
                        >
                            Save Restock
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ==========================================
            MERCHANDISE MODAL: ADD / EDIT PRODUCT
        ========================================== */}
        {showAddMerchModal && (
            <div className="modal-overlay">
                <div className="modal add-merch-modal">
                    <h2>{editingMerchItem ? "Edit Merchandise Product" : "Add New Merchandise Product"}</h2>

                    <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>Product Name</label>
                    <input
                        type="text"
                        placeholder="e.g. YOSEF Polo Shirt, Practice Workbook"
                        value={merchForm.name}
                        onChange={(e) => setMerchForm({ ...merchForm, name: e.target.value })}
                    />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div>
                            <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>Category</label>
                            <select
                                value={merchForm.category}
                                onChange={(e) => setMerchForm({ ...merchForm, category: e.target.value })}
                            >
                                <option value="Apparel">Apparel (Shirts, Uniforms)</option>
                                <option value="Stationery">Stationery (Notebooks, Paper)</option>
                                <option value="Supplies">Supplies (Kits, Pens, Bags)</option>
                                <option value="Accessories">Accessories</option>
                                <option value="Other">Other Merchandise</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>Size / Variant (Optional)</label>
                            <input
                                type="text"
                                placeholder="e.g. XS, S, M, L, XL"
                                value={merchForm.size || ""}
                                onChange={(e) => setMerchForm({ ...merchForm, size: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div>
                            <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>Unit Price (PHP)</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="300"
                                value={merchForm.price}
                                onChange={(e) => setMerchForm({ ...merchForm, price: e.target.value })}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>Stock Count</label>
                            <input
                                type="number"
                                min="0"
                                placeholder="50"
                                value={merchForm.stock}
                                onChange={(e) => setMerchForm({ ...merchForm, stock: e.target.value })}
                            />
                        </div>
                    </div>

                    <label style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>Description & Details</label>
                    <textarea
                        rows={3}
                        style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", resize: "vertical", fontFamily: "inherit", fontSize: "0.88rem" }}
                        placeholder="Brief item description, material, or available sizes..."
                        value={merchForm.description}
                        onChange={(e) => setMerchForm({ ...merchForm, description: e.target.value })}
                    />

                    <div className="modal-buttons">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setShowAddMerchModal(false)}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={handleSaveMerchItem}
                        >
                            {editingMerchItem ? "Save Changes" : "Add Product"}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {reviewRequest && (
                <div className="modal-overlay">
                    <div className="modal review-modal">
                        <h2>Review Renewal Request</h2>

                        <div className="review-summary">
                            <div>
                                <span>Student</span>
                                <strong>{reviewRequest.student?.Name || "Unknown"}</strong>
                            </div>
                            <div>
                                <span>Renewal</span>
                                <strong>{reviewRequest.months} month{reviewRequest.months > 1 ? "s" : ""}</strong>
                            </div>
                            <div>
                                <span>Amount</span>
                                <strong>₱{MONTHLY_PRICE * (reviewRequest.months || 1)}</strong>
                            </div>
                            <div>
                                <span>Submitted</span>
                                <strong>{new Date(reviewRequest.created_at).toLocaleDateString()}</strong>
                            </div>
                        </div>

                        {reviewRequest.student_note && (
                            <div className="review-note">
                                <span>Student note</span>
                                <p>{reviewRequest.student_note}</p>
                            </div>
                        )}

                        <div className="proof-frame">
                            {proofUrls[reviewRequest.proof_path] ? (
                                <a
                                    href={proofUrls[reviewRequest.proof_path]}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Open full size"
                                >
                                    <img
                                        src={proofUrls[reviewRequest.proof_path]}
                                        alt="Proof of payment"
                                    />
                                </a>
                            ) : (
                                <span className="document-missing">Proof image unavailable</span>
                            )}
                        </div>

                        <select
                            value={reviewMethod}
                            onChange={(e) => setReviewMethod(e.target.value)}
                        >
                            <option value="CASH">CASH</option>
                            <option value="PAY MAYA">PAY MAYA</option>
                            <option value="GCASH">GCASH</option>
                        </select>

                        <textarea
                            placeholder="Note to student (required when rejecting)"
                            value={reviewNote}
                            onChange={(e) => setReviewNote(e.target.value)}
                        />

                        <div className="review-actions">
                            <button
                                className="review-reject"
                                disabled={reviewing}
                                onClick={rejectRequest}
                            >
                                Reject
                            </button>
                            <button
                                className="review-approve"
                                disabled={reviewing}
                                onClick={approveRequest}
                            >
                                {reviewing ? "Processing..." : "Approve"}
                            </button>
                        </div>

                        <button className="review-close" disabled={reviewing} onClick={closeReview}>
                            Close
                        </button>
                    </div>
                </div>
            )}


        <div className="payment-sticky-header">
            <div className='Payment-Header'>
                <div className="payment-header-text">
                    <h1>ADMIN PAYMENT</h1>
                    <p className="payment-header-sub">
                        {paymentTab === "subscriptions"
                            ? "Manage student subscriptions, renewal requests, and academic service sales."
                            : "Manage physical merchandise inventory, center stock counts, and retail sales."}
                    </p>
                </div>
                <div className="payment-header-actions">
                    {paymentTab === "subscriptions" ? (
                        <>
                            <button className='ActiveUser-Button' onClick={()=>setShowSaleModal(true)}>+ Add Sales</button>
                            <button className='ActiveUser-Button secondary-header-btn' onClick={()=>setShowModal(true)}>Active User</button>
                        </>
                    ) : (
                        <>
                            <button className='ActiveUser-Button' onClick={() => {
                                if (merchandiseList.length > 0) {
                                    setQuickSellItem(merchandiseList[0]);
                                    setQuickSellQty(1);
                                    setQuickSellCustomer("");
                                    setShowQuickSellModal(true);
                                } else {
                                    alert("Please add at least one product to the catalog first.");
                                }
                            }}>
                                🛒 Sell Item
                            </button>
                            <button className='ActiveUser-Button secondary-header-btn' onClick={() => openAddMerchModal()}>
                                + New Product
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Primary Navigation Tabs */}
            <div className="admin-payment-tabs">
                <button
                    type="button"
                    className={`admin-tab-pill ${paymentTab === "subscriptions" ? "active" : ""}`}
                    onClick={() => setPaymentTab("subscriptions")}
                >
                    <span>💳 Subscriptions & Services</span>
                    {pendingRequestCount > 0 && (
                        <span className="tab-pill-badge">{pendingRequestCount} pending</span>
                    )}
                </button>
                <button
                    type="button"
                    className={`admin-tab-pill ${paymentTab === "merchandise" ? "active" : ""}`}
                    onClick={() => setPaymentTab("merchandise")}
                >
                    <span>🛍️ Merchandise & Inventory</span>
                    {lowStockCount > 0 && (
                        <span className="tab-pill-badge warning">{lowStockCount} low stock</span>
                    )}
                </button>
            </div>
        </div>

        {/* TAB 1: SUBSCRIPTIONS & SERVICES */}
        {paymentTab === "subscriptions" && (
            <>
                <div className="AdminPaymentNumberPanel">
                    <div className='PaymentNumberBox'>
                        <text>Total Revenue (YTR)</text>
                        <h1>₱{totalRevenue}</h1>
                    </div>

                    <div className='PaymentNumberBox'>
                        <text>Success Rate</text>
                        <h1>{successRate}%</h1>
                    </div>

                    <div className='PaymentNumberBox'>
                        <text>Refunds</text>
                        <h1>
                            {paymentLists.filter(p => p.status === "Refunded").length}
                        </h1>
                    </div>
                </div>

                <div className='AdminLowerPaymentPanel RenewalPanel'>

            <h1 className='TransactionHistory-Title'>
                Renewal Requests
                {pendingRequestCount > 0 && (
                    <span className='request-count'>{pendingRequestCount} pending</span>
                )}
            </h1>
            <div className="payment-toolbar">

                <input
                    type="text"
                    placeholder="Search student..."
                    value={requestSearch}
                    onChange={(e) => setRequestSearch(e.target.value)}
                />

                <div className="button-panel">
                    {["Pending", "Approved", "Rejected", "All"].map(option => (
                        <button
                            key={option}
                            className={requestFilter === option ? "active-filter" : ""}
                            onClick={() => setRequestFilter(option)}
                        >
                            {option}
                        </button>
                    ))}
                </div>
            </div>
            <div>
                <div className='mainTable'>
                    <table className='user-table'>

                        <thead>
                            <tr>
                                <th>Reference #</th>
                                <th>Student</th>
                                <th>Months</th>
                                <th>Submitted</th>
                                <th>Proof</th>
                                <th>Note</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredRequests.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="empty-row">
                                        No {requestFilter === "All" ? "" : requestFilter.toLowerCase() + " "}renewal requests.
                                    </td>
                                </tr>
                            ) : (
                                filteredRequests.map((request) => (
                                    <tr key={request.request_id}>
                                        <td><strong>REQ-{String(request.request_id).padStart(4, '0')}</strong></td>
                                        <td>{request.student?.Name || "Unknown"}</td>
                                        <td>{request.months}</td>
                                        <td>{new Date(request.created_at).toLocaleDateString()}</td>
                                        <td>
                                            {proofUrls[request.proof_path] ? (
                                                <a
                                                    className="proof-thumb"
                                                    href={proofUrls[request.proof_path]}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <img src={proofUrls[request.proof_path]} alt="Proof" />
                                                </a>
                                            ) : (
                                                <span className="document-missing-inline">N/A</span>
                                            )}
                                        </td>
                                        <td className="note-cell" title={request.student_note || ""}>
                                            {request.student_note || "—"}
                                        </td>
                                        <td>
                                            <span className={`status ${request.status.toLowerCase()}`}>
                                                {request.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                {request.status === "Pending" ? (
                                                    <button
                                                        className="review-button"
                                                        onClick={() => openReview(request)}
                                                    >
                                                        Review
                                                    </button>
                                                ) : (
                                                    <button disabled>
                                                        {request.status}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
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
                                <th>Receipt Ref #</th>
                                <th>Student</th>
                                <th>Service</th>
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
                                        <td><strong>RCPT-{String(payment.payment_id).padStart(5, '0')}</strong></td>
                                        <td>{getPaymentName(payment)}</td>
                                        <td>{payment.service || "Subscription"}</td>
                                        <td>{payment.amount}</td>
                                        <td>{new Date(payment.payment_date).toLocaleDateString()}</td>
                                        <td>{payment.method||"GCASH"}</td>
                                        <td>
                                            <span className={`status ${payment.status.toLowerCase()}`}>
                                            {payment.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
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
                                                        ? (payment.student_id ? "Cannot Refund" : "Sale")
                                                        : payment.status
                                                    }

                                                    </button>

                                                )}

                                                <button
                                                    className="delete-button"
                                                    onClick={() => {
                                                        setPaymentToDelete(payment);
                                                        setShowDeleteModal(true);
                                                    }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
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
        </>
        )}

        {/* TAB 2: MERCHANDISE & INVENTORY */}
        {paymentTab === "merchandise" && (
            <div className="merchandise-tab-container">
                {/* Merchandise Summary Cards */}
                <div className="AdminPaymentNumberPanel">
                    <div className='PaymentNumberBox'>
                        <text>Merchandise Revenue</text>
                        <h1>₱{totalMerchRevenue.toLocaleString()}</h1>
                    </div>

                    <div className='PaymentNumberBox'>
                        <text>Products in Catalog</text>
                        <h1>{merchandiseList.length} Items</h1>
                    </div>

                    <div className='PaymentNumberBox'>
                        <text>Total Stock on Hand</text>
                        <h1>{totalStockUnits} Units</h1>
                    </div>
                </div>

                {/* Merchandise Inventory Management Panel */}
                <div className='AdminLowerPaymentPanel'>
                    <div className="merch-panel-header">
                        <div>
                            <h1 className='TransactionHistory-Title' style={{ margin: 0 }}>
                                Physical Merchandise Catalog
                            </h1>
                            <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.82rem" }}>
                                Official center merchandise (Tutorial Shirt & Tutorial Notebook) per fee rates schedule.
                            </p>
                        </div>
                        <div className="merch-quick-header-actions">
                            <button
                                type="button"
                                className="ActiveUser-Button"
                                onClick={() => openAddMerchModal()}
                            >
                                + Add Product
                            </button>
                        </div>
                    </div>

                    <div className="payment-toolbar" style={{ marginTop: "14px" }}>
                        <input
                            type="text"
                            placeholder="Search merchandise..."
                            value={merchSearch}
                            onChange={(e) => setMerchSearch(e.target.value)}
                        />

                        <div className="button-panel">
                            {["All", "Apparel", "Stationery"].map(cat => (
                                <button
                                    key={cat}
                                    type="button"
                                    className={merchCategoryFilter === cat ? "active-filter" : ""}
                                    onClick={() => setMerchCategoryFilter(cat)}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className='mainTable'>
                        <table className='user-table'>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Product Name & Category</th>
                                    <th>Description</th>
                                    <th>Unit Price</th>
                                    <th>Stock Level</th>
                                    <th>Units Sold</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMerchandise.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="empty-row">
                                            No merchandise items found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredMerchandise.map((item, idx) => (
                                        <tr key={item.id}>
                                            <td>{idx + 1}</td>
                                            <td>
                                                <div className="merch-name-cell">
                                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                                        <strong>{item.name}</strong>
                                                        {item.size && <span className="merch-size-badge">Size: {item.size}</span>}
                                                    </div>
                                                    <span className="merch-cat-pill">{item.category || "Item"}</span>
                                                </div>
                                            </td>
                                            <td style={{ maxWidth: "240px", fontSize: "0.82rem", color: "#64748b" }}>
                                                {item.description || "—"}
                                            </td>
                                            <td>
                                                <strong style={{ color: "#0f172a" }}>₱{item.price.toLocaleString()}</strong>
                                            </td>
                                            <td>
                                                <span className={`stock-pill ${item.stock > 10 ? "in-stock" : item.stock > 0 ? "low-stock" : "out-of-stock"}`}>
                                                    {item.stock > 10 ? `In Stock (${item.stock})` : item.stock > 0 ? `Low Stock (${item.stock})` : "Out of Stock (0)"}
                                                </span>
                                            </td>
                                            <td>
                                                <span style={{ fontWeight: 600, color: "#1e293b" }}>{getUnitsSold(item)} sold</span>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        type="button"
                                                        className="btn-merch-action sell"
                                                        disabled={item.stock <= 0}
                                                        onClick={() => {
                                                            setQuickSellItem(item);
                                                            setQuickSellQty(1);
                                                            setQuickSellCustomer("");
                                                            setShowQuickSellModal(true);
                                                        }}
                                                    >
                                                        Sell
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-merch-action restock"
                                                        onClick={() => {
                                                            setRestockTarget(item);
                                                            setRestockAmount(10);
                                                            setShowRestockModal(true);
                                                        }}
                                                    >
                                                        Restock
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-merch-action edit"
                                                        onClick={() => openAddMerchModal(item)}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="delete-button"
                                                        onClick={() => handleDeleteMerchItem(item.id, item.name)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {
            showRefundModal && (

            <div className="modal-overlay">

                <div className="modal">

                    <h2>Refund Payment</h2>

                    <p>
                        Student:
                        <strong>
                            {selectedPayment && getPaymentName(selectedPayment)}
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

                    <div className="modal-buttons">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={()=>{
                                setShowRefundModal(false);
                                setSelectedPayment(null);
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn-primary"
                            disabled={loading}
                            onClick={refundPayment}
                        >
                            {loading ? "Refunding..." : "Confirm Refund"}
                        </button>
                    </div>

                </div>

            </div>

            )
            }

        {
            showDeleteModal && (

            <div className="modal-overlay">

                <div className="modal">

                    <h2>Delete Transaction</h2>

                    <p>
                        Student:
                        <strong>
                            {paymentToDelete && getPaymentName(paymentToDelete)}
                        </strong>
                    </p>

                    <p>
                        Amount:
                        <strong>
                            ₱{paymentToDelete?.amount}
                        </strong>
                    </p>

                    <p>
                        This permanently removes the transaction and recalculates the
                        student's subscription status. This cannot be undone.
                    </p>

                    <div className="modal-buttons">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={()=>{
                                setShowDeleteModal(false);
                                setPaymentToDelete(null);
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn-danger"
                            disabled={deleting}
                            onClick={deletePayment}
                        >
                            {deleting ? "Deleting..." : "Confirm Delete"}
                        </button>
                    </div>

                </div>

            </div>

            )
            }
    </>);
}

export default AdminPayment