import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { createNotification } from "../../Services/notificationService";
import {
    CalendarClock,
    ImagePlus,
    X,
    CheckCircle2,
    Clock3,
    XCircle
} from "lucide-react";
import "./studentSubscriptionView.css";

const DAY = 24 * 60 * 60 * 1000;
const MAX_PROOF_SIZE = 5 * 1024 * 1024; // 5 MB
const EXPIRING_SOON_DAYS = 7;
const PROOF_BUCKET = "renewal-proofs";

// ==========================================
// DATE HELPERS
// ==========================================

// Same month math AdminPayment uses, so the "if approved"
// preview matches what the admin will actually apply.
function addMonths(date, months) {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}

function getRemaining(expiry, now) {
    const diff = expiry - now;
    if (diff <= 0) return null;

    let months =
        (expiry.getFullYear() - now.getFullYear()) * 12 +
        (expiry.getMonth() - now.getMonth());

    if (addMonths(now, months) > expiry) months--;
    months = Math.max(months, 0);

    const days = Math.floor((expiry - addMonths(now, months)) / DAY);

    return {
        months,
        days,
        totalDays: Math.floor(diff / DAY),
        hours: Math.floor(diff / 3600000) % 24,
        minutes: Math.floor(diff / 60000) % 60,
        seconds: Math.floor(diff / 1000) % 60
    };
}

function formatDate(date) {
    return date.toLocaleDateString("en-PH", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

function formatTime(date) {
    return date.toLocaleTimeString("en-PH", {
        hour: "numeric",
        minute: "2-digit"
    });
}

function plural(n, word) {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function pad(n) {
    return String(n).padStart(2, "0");
}

// ==========================================
// COMPONENT
// ==========================================

function StudentSubscriptionView() {

    const [student, setStudent] = useState(null);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(new Date());

    const [showModal, setShowModal] = useState(false);
    const [proofFile, setProofFile] = useState(null);
    const [proofPreview, setProofPreview] = useState(null);
    const [note, setNote] = useState("");
    const [formError, setFormError] = useState("");
    const [submitting, setSubmitting] = useState(false);


    // ==========================================
    // LOAD
    // ==========================================

    useEffect(() => {
        loadData();
    }, []);

    // live countdown
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // close modal with Escape
    useEffect(() => {
        if (!showModal) return;

        function onKey(e) {
            if (e.key === "Escape" && !submitting) closeModal();
        }

        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [showModal, submitting]);

    // free the preview object URL
    useEffect(() => {
        return () => {
            if (proofPreview) URL.revokeObjectURL(proofPreview);
        };
    }, [proofPreview]);


    async function loadData() {
        setLoading(true);

        try {
            const { data: { user }, error: authError } =
                await supabase.auth.getUser();

            if (authError || !user) {
                console.log("Authentication error:", authError);
                return;
            }

            const { data: studentData, error: studentError } = await supabase
                .from("users")
                .select("id, Name, Status, Subscription_Expires")
                .eq("auth_id", user.id)
                .single();

            if (studentError) {
                console.log("Student error:", studentError);
                return;
            }

            setStudent(studentData);
            await loadRequests(studentData.id);

        } catch (error) {
            console.log("Subscription loading error:", error);
        } finally {
            setLoading(false);
        }
    }

    async function loadRequests(studentId) {
        const { data, error } = await supabase
            .from("renewal_requests")
            .select("*")
            .eq("student_id", studentId)
            .order("created_at", { ascending: false })
            .limit(5);

        if (error) {
            console.log("Renewal requests error:", error);
            return;
        }

        setRequests(data || []);
    }


    // ==========================================
    // DERIVED VALUES
    // ==========================================

    const expiry = student?.Subscription_Expires
        ? new Date(student.Subscription_Expires)
        : null;

    const remaining = expiry ? getRemaining(expiry, now) : null;

    let state = "none";
    if (expiry && !remaining) state = "expired";
    else if (remaining && remaining.totalDays < EXPIRING_SOON_DAYS) state = "soon";
    else if (remaining) state = "active";

    const pendingRequest = requests.find(r => r.status === "Pending");

    // If approved, the admin extends from the later of
    // (current expiry, today) by one month.
    const projectedExpiry = addMonths(
        expiry && expiry > now ? expiry : now,
        1
    );


    // ==========================================
    // MODAL / FILE
    // ==========================================

    function openModal() {
        setFormError("");
        setShowModal(true);
    }

    function closeModal() {
        setShowModal(false);
        setProofFile(null);
        setProofPreview(null);
        setNote("");
        setFormError("");
    }

    function handleFileChange(e) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setFormError("Please choose an image file (JPG, PNG, etc.).");
            return;
        }

        if (file.size > MAX_PROOF_SIZE) {
            setFormError("The image is too large. Maximum size is 5 MB.");
            return;
        }

        setFormError("");
        setProofFile(file);
        setProofPreview(URL.createObjectURL(file));
    }

    function removeFile() {
        setProofFile(null);
        setProofPreview(null);
    }


    // ==========================================
    // SUBMIT REQUEST
    // ==========================================

    async function submitRequest() {

        if (!student || submitting) return;

        if (!proofFile) {
            setFormError("Please upload a picture of your proof of payment.");
            return;
        }

        setSubmitting(true);
        setFormError("");

        // 1. upload the image
        const ext = proofFile.name.split(".").pop();
        const filePath = `${student.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from(PROOF_BUCKET)
            .upload(filePath, proofFile, {
                cacheControl: "3600",
                upsert: false
            });

        if (uploadError) {
            console.log(uploadError);
            setFormError("Failed to upload the image: " + uploadError.message);
            setSubmitting(false);
            return;
        }

        // 2. create the request
        const { data: inserted, error: insertError } = await supabase
            .from("renewal_requests")
            .insert({
                student_id: student.id,
                months: 1,
                proof_path: filePath,
                student_note: note.trim() || null,
                status: "Pending"
            })
            .select()
            .single();

        if (insertError) {
            console.log(insertError);

            // remove the orphaned upload
            await supabase.storage.from(PROOF_BUCKET).remove([filePath]);

            setFormError(
                insertError.code === "23505"
                    ? "You already have a pending renewal request."
                    : "Failed to send the request: " + insertError.message
            );
            setSubmitting(false);
            return;
        }

        // 3. notify admins (best effort)
        try {
            const { data: admins } = await supabase
                .from("users")
                .select("id")
                .eq("Role", "Admin");

            await Promise.all(
                (admins || []).map(admin =>
                    createNotification({
                        userId: admin.id,
                        title: "Renewal request",
                        message: `${student.Name} sent proof of payment for a 1-month renewal.`,
                        type: "payment",
                        relatedTable: "renewal_requests",
                        relatedId: inserted.request_id,
                        actionUrl: "/admin/payment"
                    })
                )
            );
        } catch (error) {
            console.log("Admin notification error:", error);
        }

        await loadRequests(student.id);
        setSubmitting(false);
        closeModal();
    }


    // ==========================================
    // RENDER
    // ==========================================

    if (loading) {
        return <div className="sub-page"><p className="sub-muted">Loading subscription…</p></div>;
    }

    if (!student) {
        return <div className="sub-page"><p className="sub-muted">We couldn’t load your subscription.</p></div>;
    }

    return (
        <div className="sub-page">

            <header className="sub-header">
                <h1>Manage Subscription</h1>
                <p className="sub-muted">
                    See when your access ends and request a renewal ahead of time.
                </p>
            </header>


            {/* ======================================
                EXPIRATION
            ====================================== */}

            <section className={`sub-hero sub-hero-${state}`}>

                {state === "none" ? (
                    <>
                        <p className="sub-hero-label">Subscription</p>
                        <h2 className="sub-hero-date">No active subscription</h2>
                        <p className="sub-hero-time">
                            You don’t have an access period on record yet.
                        </p>
                    </>
                ) : (
                    <>
                        <p className="sub-hero-label">
                            {state === "expired"
                                ? "Your access ended on"
                                : "Your access ends on"}
                        </p>

                        <h2 className="sub-hero-date">{formatDate(expiry)}</h2>

                        <p className="sub-hero-time">
                            at {formatTime(expiry)}
                        </p>
                    </>
                )}

                {remaining && (
                    <>
                        <div className="sub-countdown" role="timer" aria-live="off">
                            <div className="sub-tile">
                                <strong>{remaining.totalDays}</strong>
                                <span>{remaining.totalDays === 1 ? "day" : "days"} left</span>
                            </div>
                            <div className="sub-tile">
                                <strong>{pad(remaining.hours)}</strong>
                                <span>hours</span>
                            </div>
                            <div className="sub-tile">
                                <strong>{pad(remaining.minutes)}</strong>
                                <span>minutes</span>
                            </div>
                            <div className="sub-tile">
                                <strong>{pad(remaining.seconds)}</strong>
                                <span>seconds</span>
                            </div>
                        </div>

                        <p className="sub-hero-summary">
                            {plural(remaining.totalDays, "day")} in total, or{" "}
                            {plural(remaining.months, "month")} and{" "}
                            {plural(remaining.days, "day")}.
                            {state === "soon" && " Your access is ending soon."}
                        </p>
                    </>
                )}

                {state === "expired" && (
                    <p className="sub-hero-summary">
                        Your access is paused until a renewal is approved.
                    </p>
                )}

            </section>


            {/* ======================================
                ADVANCE RENEWAL
            ====================================== */}

            <section className="sub-card">

                <div className="sub-card-text">
                    <h3>Advance Renewal</h3>
                    <p className="sub-muted">
                        Request one more month of access. Upload a picture of
                        your proof of payment and an admin will review it.
                    </p>

                    {pendingRequest && (
                        <p className="sub-pending-note">
                            <Clock3 size={15} />
                            Your request from{" "}
                            {new Date(pendingRequest.created_at).toLocaleDateString("en-PH", {
                                month: "short", day: "numeric"
                            })}{" "}
                            is waiting for admin review.
                        </p>
                    )}
                </div>

                <button
                    type="button"
                    className="sub-primary-btn"
                    onClick={openModal}
                    disabled={!!pendingRequest}
                >
                    <CalendarClock size={17} />
                    {pendingRequest ? "Request Pending" : "Advance Renewal"}
                </button>

            </section>


            {/* ======================================
                REQUEST HISTORY
            ====================================== */}

            {requests.length > 0 && (
                <section className="sub-history">

                    <h3>Recent requests</h3>

                    <ul>
                        {requests.map(req => (
                            <li key={req.request_id} className="sub-history-item">

                                <div className="sub-history-main">
                                    <span className="sub-history-title">
                                        {plural(req.months, "month")} renewal
                                    </span>
                                    <span className="sub-muted">
                                        Sent {new Date(req.created_at).toLocaleDateString("en-PH", {
                                            month: "short", day: "numeric", year: "numeric"
                                        })}
                                    </span>
                                    {req.status === "Rejected" && req.admin_note && (
                                        <span className="sub-reject-note">
                                            Admin note: {req.admin_note}
                                        </span>
                                    )}
                                </div>

                                <span className={`sub-badge sub-badge-${req.status.toLowerCase()}`}>
                                    {req.status === "Approved" && <CheckCircle2 size={14} />}
                                    {req.status === "Pending" && <Clock3 size={14} />}
                                    {req.status === "Rejected" && <XCircle size={14} />}
                                    {req.status}
                                </span>

                            </li>
                        ))}
                    </ul>

                </section>
            )}


            {/* ======================================
                REQUEST MODAL
            ====================================== */}

            {showModal && (
                <div
                    className="sub-overlay"
                    onClick={() => !submitting && closeModal()}
                >
                    <div
                        className="sub-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="sub-modal-title"
                        onClick={e => e.stopPropagation()}
                    >

                        <div className="sub-modal-head">
                            <h3 id="sub-modal-title">Request 1 more month</h3>
                            <button
                                type="button"
                                className="sub-icon-btn"
                                onClick={closeModal}
                                disabled={submitting}
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <p className="sub-modal-projection">
                            If approved, your access will run until{" "}
                            <strong>{formatDate(projectedExpiry)}</strong>.
                        </p>

                        <p className="sub-field-label">Proof of payment (required)</p>

                        {proofPreview ? (
                            <div className="sub-proof">
                                <img src={proofPreview} alt="Proof of payment preview" />
                                <button
                                    type="button"
                                    className="sub-link-btn"
                                    onClick={removeFile}
                                    disabled={submitting}
                                >
                                    Remove image
                                </button>
                            </div>
                        ) : (
                            <label className="sub-dropzone">
                                <ImagePlus size={26} />
                                <span>Choose an image</span>
                                <small>JPG or PNG, up to 5 MB</small>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                            </label>
                        )}

                        <label className="sub-field-label" htmlFor="sub-note">
                            Note for the admin (optional)
                        </label>
                        <textarea
                            id="sub-note"
                            className="sub-textarea"
                            rows={3}
                            maxLength={300}
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Reference number, payment method, etc."
                            disabled={submitting}
                        />

                        {formError && (
                            <p className="sub-error" role="alert">{formError}</p>
                        )}

                        <div className="sub-modal-actions">
                            <button
                                type="button"
                                className="sub-secondary-btn"
                                onClick={closeModal}
                                disabled={submitting}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="sub-primary-btn"
                                onClick={submitRequest}
                                disabled={submitting || !proofFile}
                            >
                                {submitting ? "Sending…" : "Send request"}
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}

export default StudentSubscriptionView;