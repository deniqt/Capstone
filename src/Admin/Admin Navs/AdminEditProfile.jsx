import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./adminEditProfile.css";
import { supabase } from "../../lib/supabase";

function AdminEditProfile() {

    const { id } = useParams();
    const navigate = useNavigate();

    const [infos, setInfos] = useState(null);
    const [otherInfos, setOtherInfos] = useState(null);
    const [tutors, setTutors] = useState([]);
    const [previousTutors, setPreviousTutors] = useState([]);

    const [image, setImage] = useState(null);
    const [imageFile, setImageFile] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Delete user
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [isSelf, setIsSelf] = useState(false);


    // ==========================================
    // LOAD DATA
    // ==========================================

    useEffect(() => {

        if (!id) {
            return;
        }

        loadProfile();
        getTutors();

    }, [id]);


    // ==========================================
    // LOAD USER + USER DETAILS
    // ==========================================

    async function loadProfile() {

        try {

            setLoading(true);

            // --------------------------------------
            // GET USER
            // --------------------------------------

            const {
                data: userData,
                error: userError
            } = await supabase
                .from("users")
                .select("*")
                .eq("id", id)
                .single();


            if (userError) {

                console.error(
                    "User loading error:",
                    userError
                );

                alert("Failed to load user.");

                return;

            }


            if (!userData) {

                alert("User not found.");

                return;

            }


            setInfos(userData);

            // Don't let an admin delete the account they're logged in with
            const {
                data: { user: authUser }
            } = await supabase.auth.getUser();

            setIsSelf(
                !!authUser &&
                authUser.id === userData.auth_id
            );


            // --------------------------------------
            // CHECK DETAIL ID
            // --------------------------------------

            if (!userData.detail_id) {

                console.error(
                    "User has no detail_id:",
                    userData
                );

                setOtherInfos(null);

                return;

            }


            // --------------------------------------
            // GET USER DETAILS
            // --------------------------------------

            const {
                data: detailData,
                error: detailError
            } = await supabase
                .from("user_details")
                .select("*")
                .eq(
                    "detail_id",
                    userData.detail_id
                )
                .single();


            if (detailError) {

                console.error(
                    "Profile loading error:",
                    detailError
                );

                alert(
                    "Failed to load profile information."
                );

                return;

            }


            setOtherInfos(detailData);

            // Load past sessions from calendar to detect previous tutors
            if (userData.Role === "Student") {
                const { data: pastSessions } = await supabase
                    .from("calendar")
                    .select("tutor_id, start_datetime")
                    .eq("student_id", id)
                    .order("start_datetime", { ascending: true });

                if (pastSessions && pastSessions.length > 0) {
                    const { data: tutorUsers } = await supabase
                        .from("users")
                        .select("id, Name")
                        .eq("Role", "Tutor");

                    const tMap = {};
                    (tutorUsers || []).forEach(t => { tMap[t.id] = t.Name; });

                    const pMap = {};
                    pastSessions.forEach(s => {
                        const sTutorId = Number(s.tutor_id);
                        const currId = Number(detailData.Tutor_ID);
                        if (sTutorId && sTutorId !== currId) {
                            if (!pMap[sTutorId]) {
                                pMap[sTutorId] = {
                                    id: sTutorId,
                                    name: tMap[sTutorId] || ("Tutor #" + sTutorId),
                                    count: 0,
                                    firstDate: s.start_datetime,
                                    lastDate: s.start_datetime
                                };
                            }
                            pMap[sTutorId].count++;
                            if (new Date(s.start_datetime) < new Date(pMap[sTutorId].firstDate)) {
                                pMap[sTutorId].firstDate = s.start_datetime;
                            }
                            if (new Date(s.start_datetime) > new Date(pMap[sTutorId].lastDate)) {
                                pMap[sTutorId].lastDate = s.start_datetime;
                            }
                        }
                    });
                    setPreviousTutors(Object.values(pMap));
                }
            }

        } catch (error) {

            console.error(
                "Load profile error:",
                error
            );

            alert(
                error.message ||
                "Failed to load profile."
            );

        } finally {

            setLoading(false);

        }

    }


    // ==========================================
    // DELETE USER
    // ==========================================
    // Removing a login (auth.users) can't be done from the browser,
    // so this calls the "delete-user" edge function, which checks the
    // caller is an Admin and cleans up every table that points at the user.

    async function handleDelete() {

        if (!infos || deleting) {
            return;
        }

        try {

            setDeleting(true);

            const {
                data,
                error
            } = await supabase.functions.invoke(
                "delete-user",
                {
                    body: {
                        userId: infos.id
                    }
                }
            );

            if (error) {
                let errorMsg = error.message;
                try {
                    if (error.context && typeof error.context.json === "function") {
                        const errJson = await error.context.json();
                        if (errJson?.error) {
                            errorMsg = errJson.error;
                        }
                    } else if (error.context && typeof error.context.text === "function") {
                        const errText = await error.context.text();
                        if (errText) {
                            try {
                                const parsed = JSON.parse(errText);
                                if (parsed?.error) errorMsg = parsed.error;
                            } catch (_) {
                                errorMsg = errText;
                            }
                        }
                    }
                } catch (parseErr) {
                    console.warn("Could not parse Edge Function error context:", parseErr);
                }
                throw new Error(errorMsg);
            }

            if (data?.error) {
                throw new Error(data.error);
            }

            setShowDeleteModal(false);

            alert("User deleted successfully.");

            navigate("/admin/student-and-tutor");

        } catch (error) {

            console.error(
                "Delete user error:",
                error
            );

            alert(
                error.message ||
                "Failed to delete user."
            );

        } finally {

            setDeleting(false);

        }

    }


    // ==========================================
    // GET TUTORS
    // ==========================================

    async function getTutors() {

        const {
            data,
            error
        } = await supabase
            .from("users")
            .select("id, Name")
            .eq("Role", "Tutor")
            .order("Name", {
                ascending: true
            });


        if (error) {

            console.error(
                "Tutor loading error:",
                error
            );

            return;

        }


        setTutors(data || []);

    }


    // ==========================================
    // USER INFORMATION CHANGE
    // ==========================================

    function handleInfoChange(event) {

        const {
            name,
            value
        } = event.target;


        setInfos(prev => ({

            ...prev,

            [name]: value

        }));

    }


    // ==========================================
    // OTHER INFORMATION CHANGE
    // ==========================================

    function handleOtherInfoChange(event) {

        const {
            name,
            value
        } = event.target;


        setOtherInfos(prev => ({

            ...prev,

            [name]: value

        }));

    }


    // ==========================================
    // IMAGE CHANGE
    // ==========================================

    function handleImageChange(event) {

        const file =
            event.target.files?.[0];


        if (!file) {
            return;
        }


        setImageFile(file);

        setImage(
            URL.createObjectURL(file)
        );

    }


    // ==========================================
    // SAVE PROFILE IMAGE
    // ==========================================

    async function uploadProfileImage() {

        if (!imageFile) {

            return otherInfos?.profile_url || null;

        }


        const file =
            imageFile;


        const fileExt =
            file.name.split(".").pop();


        const fileName =
            `${crypto.randomUUID()}.${fileExt}`;


        const filePath =
            `profiles/${fileName}`;


        const {
            error: uploadError
        } = await supabase.storage
            .from("profiles")
            .upload(
                filePath,
                file,
                {
                    upsert: false
                }
            );


        if (uploadError) {

            throw uploadError;

        }


        const {
            data
        } = supabase.storage
            .from("profiles")
            .getPublicUrl(
                filePath
            );


        return data.publicUrl;

    }


    // ==========================================
    // SAVE CHANGES
    // ==========================================

    async function handleSave() {

        if (!infos || !otherInfos) {

            alert(
                "Profile information is not loaded yet."
            );

            return;

        }


        const confirmed =
            window.confirm(
                "Are you sure you want to save the changes?"
            );


        if (!confirmed) {
            return;
        }


        try {

            setSaving(true);


            // ======================================
            // PROFILE IMAGE
            // ======================================

            const imageUrl =
                await uploadProfileImage();


            // ======================================
            // UPDATE USERS
            // ======================================

            const {
                error: userError
            } = await supabase
                .from("users")
                .update({

                    Name:
                        infos.Name,

                    Email:
                        infos.Email,

                    Role:
                        infos.Role,

                    Joined:
                        infos.Joined,

                    Status:
                        infos.Status

                })
                .eq(
                    "id",
                    infos.id
                );


            if (userError) {

                throw userError;

            }


            // ======================================
            // UPDATE USER DETAILS
            // ======================================

            const {
                error: detailError
            } = await supabase
                .from("user_details")
                .update({

                    profile_url:
                        imageUrl,

                    school:
                        otherInfos.school,

                    Address:
                        otherInfos.Address,

                    date_of_birth:
                        otherInfos.date_of_birth,

                    Tutor_ID:
                        otherInfos.Tutor_ID
                            ? Number(
                                otherInfos.Tutor_ID
                            )
                            : null,

                    Grade_Level:
                        otherInfos.Grade_Level,


                    phone_number:
                        otherInfos.phone_number

                })
                .eq(
                    "detail_id",
                    otherInfos.detail_id
                );


            if (detailError) {

                throw detailError;

            }


            // ======================================
            // UPDATE LOCAL STATE
            // ======================================

            setOtherInfos(prev => ({

                ...prev,

                profile_url:
                    imageUrl

            }));


            setImageFile(null);


            alert(
                "Changes saved successfully!"
            );


        } catch (error) {

            console.error(
                "Save profile error:",
                error
            );


            alert(
                error.message ||
                "Failed to save changes."
            );

        } finally {

            setSaving(false);

        }

    }


    // ==========================================
    // LOADING
    // ==========================================

    if (loading) {

        return (

            <div className="admin-edit-profile">

                <h1 id="SATTitle">
                    Student & Teacher
                </h1>

                <p>
                    Loading profile...
                </p>

            </div>

        );

    }


    // ==========================================
    // USER NOT FOUND
    // ==========================================

    if (!infos) {

        return (

            <div className="admin-edit-profile">

                <h1 id="SATTitle">
                    Student & Teacher
                </h1>

                <p>
                    User not found.
                </p>

                <button
                    className="aep-btn aep-btn-secondary"
                    onClick={() =>
                        navigate("/admin/StudentAndTutor")
                    }
                >
                    Back
                </button>

            </div>

        );

    }


    // ==========================================
    // RENDER
    // ==========================================

    return (

        <div className="admin-edit-profile">

            <h1 id="SATTitle">
                Student & Teacher
            </h1>


            {/* ==================================
                HEADER
            ================================== */}

            <div className="buttonPanel">

                <p>
                    Edit User: {infos.Name}
                </p>


                <div className="buttonBox">

                    <button
                        className="aep-btn aep-btn-danger"
                        onClick={() =>
                            setShowDeleteModal(true)
                        }
                        disabled={saving || deleting || isSelf}
                        title={
                            isSelf
                                ? "You can't delete your own account"
                                : "Delete this user"
                        }
                    >
                        Delete User
                    </button>


                    <button
                        className="aep-btn aep-btn-secondary"
                        onClick={() =>
                            navigate(
                                "/admin/student-and-tutor"
                            )
                        }
                        disabled={saving}
                    >
                        Cancel
                    </button>


                    <button
                        className="aep-btn aep-btn-primary"
                        onClick={handleSave}
                        disabled={
                            saving ||
                            !otherInfos
                        }
                    >
                        {saving
                            ? "Saving..."
                            : "Save Changes"
                        }
                    </button>

                </div>

            </div>


            {/* ==================================
                PROFILE
            ================================== */}

            <div className="info-panel">


                {/* ==================================
                    PERSONAL INFORMATION
                ================================== */}

                <div className="personal-box">

                    <h3>
                        Personal Information
                    </h3>


                    {/* PROFILE PICTURE */}

                    <div className="picture-panel">

                        <img
                            src={
                                image ||
                                otherInfos?.profile_url ||
                                "https://placehold.co/150x150?text=Profile"
                            }
                            alt="Profile"
                            className="profile-avatar"
                        />


                        <div id="profile-label-box">

                            <label htmlFor="profile-upload">
                                Profile Picture
                            </label>

                            <br />

                            <input
                                id="profile-upload"
                                type="file"
                                accept="image/*"
                                onChange={
                                    handleImageChange
                                }
                                disabled={saving}
                            />

                        </div>

                    </div>


                    {/* PERSONAL FIELDS */}

                    <div id="personalInfo-box">


                        {/* FULL NAME */}

                        <div className="labelbox">

                            <label>
                                Full Name
                            </label>

                            <input
                                type="text"
                                name="Name"
                                className="input-style"
                                value={
                                    infos.Name || ""
                                }
                                onChange={
                                    handleInfoChange
                                }
                            />

                        </div>


                        {/* EMAIL */}

                        <div className="labelbox">

                            <label>
                                Email
                            </label>

                            <input
                                type="email"
                                name="Email"
                                className="input-style"
                                value={
                                    infos.Email || ""
                                }
                                onChange={
                                    handleInfoChange
                                }
                            />

                        </div>


                        {/* DATE OF BIRTH */}

                        <div className="labelbox">

                            <label>
                                Date Of Birth
                            </label>

                            <input
                                type="date"
                                name="date_of_birth"
                                className="input-style"
                                value={
                                    otherInfos?.date_of_birth ||
                                    ""
                                }
                                onChange={
                                    handleOtherInfoChange
                                }
                            />

                        </div>


                        {/* SCHOOL */}

                        <div className="labelbox">

                            <label>
                                School
                            </label>

                            <input
                                type="text"
                                name="school"
                                className="input-style"
                                value={
                                    otherInfos?.school ||
                                    ""
                                }
                                onChange={
                                    handleOtherInfoChange
                                }
                            />

                        </div>


                        {/* ADDRESS */}

                        <div className="labelbox">

                            <label>
                                Address
                            </label>

                            <input
                                type="text"
                                name="Address"
                                className="input-style"
                                value={
                                    otherInfos?.Address ||
                                    ""
                                }
                                onChange={
                                    handleOtherInfoChange
                                }
                            />

                        </div>


                        {/* PHONE */}

                        <div className="labelbox">

                            <label>
                                Phone Number
                            </label>

                            <input
                                type="text"
                                name="phone_number"
                                className="input-style"
                                value={
                                    otherInfos?.phone_number ||
                                    ""
                                }
                                onChange={
                                    handleOtherInfoChange
                                }
                            />

                        </div>

                    </div>

                </div>


                {/* ==================================
                    ACCOUNT SETTINGS
                ================================== */}

                <div className="Account-Settings-Panel">

                    <h3>
                        Account Settings
                    </h3>


                    <div id="Account-Settings-box">


                        {/* ROLE */}

                        <div className="labelbox">

                            <label>
                                Role
                            </label>

                            <input
                                type="text"
                                name="Role"
                                className="input-style"
                                value={
                                    infos.Role || ""
                                }
                                disabled
                            />

                        </div>


                        {/* STATUS */}

                        <div className="labelbox">

                            <label>
                                Status
                            </label>

                            <select
                                name="Status"
                                className="input-style"
                                value={
                                    infos.Status || "Inactive"
                                }
                                onChange={
                                    handleInfoChange
                                }
                            >

                                <option value="Active">
                                    Active
                                </option>

                                <option value="Inactive">
                                    Inactive
                                </option>

                            </select>

                        </div>


                        {/* TUTOR */}

                        {infos.Role === "Student" && (

                            <div className="labelbox">

                                <label>
                                    Tutor
                                </label>

                                <select
                                    name="Tutor_ID"
                                    className="input-style"
                                    value={
                                        otherInfos?.Tutor_ID ||
                                        ""
                                    }
                                    onChange={
                                        handleOtherInfoChange
                                    }
                                >

                                    <option value="">
                                        Select a Tutor
                                    </option>


                                    {tutors.map(
                                        tutor => (

                                            <option
                                                key={
                                                    tutor.id
                                                }
                                                value={
                                                    tutor.id
                                                }
                                            >
                                                {
                                                    tutor.Name
                                                }
                                            </option>

                                        )
                                    )}

                                </select>

                                {previousTutors.length > 0 ? (
                                    <div className="aep-prev-tutor-banner">
                                        <span className="aep-prev-tutor-label">⏮️ Previous Tutor History:</span>
                                        {previousTutors.map(pt => (
                                            <div key={pt.id} className="aep-prev-tutor-item">
                                                <strong>{pt.name}</strong>
                                                <span> — {pt.count} session{pt.count === 1 ? "" : "s"} ({formatDate(pt.firstDate)} – {formatDate(pt.lastDate)})</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="aep-prev-tutor-muted">
                                        ℹ️ First assigned tutor (no previous reassignments on record)
                                    </div>
                                )}

                            </div>

                        )}


                        {/* GRADE LEVEL */}

                        {infos.Role === "Student" && (

                            <div className="labelbox">

                                <label>
                                    Grade Level
                                </label>

                                <input
                                    type="text"
                                    name="Grade_Level"
                                    className="input-style"
                                    value={
                                        otherInfos?.Grade_Level ||
                                        ""
                                    }
                                    onChange={
                                        handleOtherInfoChange
                                    }
                                />

                            </div>

                        )}



                        {/* USERNAME */}

                        <div className="labelbox">

                            <label>
                                Username
                            </label>

                            <input
                                type="text"
                                className="input-style"
                                value={
                                    infos.Email || ""
                                }
                                disabled
                            />

                        </div>


                        {/* PASSWORD */}

                        <div className="labelbox">

                            <label>
                                Password
                            </label>

                            <input
                                type="password"
                                className="input-style"
                                value="********"
                                disabled
                            />

                            <small>
                                Password cannot be edited here.
                            </small>

                        </div>


                        {/* JOINED */}

                        <div className="labelbox">

                            <label>
                                Joined Date
                            </label>

                            <input
                                type="date"
                                name="Joined"
                                className="input-style"
                                value={
                                    infos.Joined || ""
                                }
                                onChange={
                                    handleInfoChange
                                }
                            />

                        </div>

                    </div>

                </div>

            </div>


            {/* ==================================
                DELETE CONFIRMATION
            ================================== */}

            {showDeleteModal && (

                <div className="aep-modal-overlay">

                    <div className="aep-modal">

                        <h2>
                            Delete User
                        </h2>

                        <p>
                            You are about to permanently delete
                            <strong>
                                {infos.Name}
                            </strong>
                            ({infos.Role}).
                        </p>

                        <p>
                            This removes their account, profile,
                            messages, schedule and submissions.
                            Payment records are kept for your
                            revenue history. This cannot be undone.
                        </p>

                        <div className="aep-modal-actions">

                            <button
                                className="aep-btn aep-btn-secondary"
                                onClick={() =>
                                    setShowDeleteModal(false)
                                }
                                disabled={deleting}
                            >
                                Cancel
                            </button>

                            <button
                                className="aep-btn aep-btn-danger-solid"
                                onClick={handleDelete}
                                disabled={deleting}
                            >
                                {deleting
                                    ? "Deleting..."
                                    : "Confirm Delete"
                                }
                            </button>

                        </div>

                    </div>

                </div>

            )}

        </div>

    );

}

export default AdminEditProfile;