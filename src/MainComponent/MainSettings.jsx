import { useEffect, useState } from "react";
import "./mainSettings.css";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";

function MainSettings() {

    const navigate = useNavigate();
    // ==========================================
    // LOGOUT
    // ==========================================

    async function handleLogout() {
        const confirmed = window.confirm(
            "Are you sure you want to Log out?"
        );
        if (!confirmed) {
            return;
        }

        const { error } =
            await supabase.auth.signOut();


        if (error) {

            alert(error.message);
            return;

        }

        navigate("/");

    }

    // ==========================================
    // ACCORDION
    // ==========================================

    const [openSection, setOpenSection] = useState(null);


    // ==========================================
    // USER DATA
    // ==========================================

    const [infos, setInfos] = useState(null);
    const [otherInfos, setOtherInfos] = useState(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);


    // ==========================================
    // PROFILE IMAGE
    // ==========================================

    const [image, setImage] = useState(null);
    const [imageFile, setImageFile] = useState(null);


    // ==========================================
    // PASSWORD
    // ==========================================
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [logoutOtherDevices, setLogoutOtherDevices] = useState(false);

    const [changingPassword, setChangingPassword] = useState(false);


    // ==========================================
    // NOTIFICATION PREFERENCES
    // ==========================================

    const [notificationPreferences, setNotificationPreferences] =
        useState(null);

    const [loadingNotifications, setLoadingNotifications] =
        useState(false);

    const [savingNotifications, setSavingNotifications] =
        useState(false);



    // ==========================================
    // CHANGE PASSWORD
    // ==========================================

    async function handleChangePassword() {

        // ======================================
        // VALIDATION
        // ======================================

        if (
            !currentPassword ||
            !newPassword ||
            !confirmPassword
        ) {

            alert(
                "Fill up all fields."
            );

            return;

        }


        // ======================================
        // CHECK NEW PASSWORD
        // ======================================

        if (newPassword !== confirmPassword) {

            alert(
                "New password and confirm password do not match."
            );

            return;

        }


        // ======================================
        // PASSWORD LENGTH
        // ======================================

        if (newPassword.length < 6) {

            alert(
                "New password must be at least 6 characters."
            );

            return;

        }


        // ======================================
        // GET CURRENT AUTH USER
        // ======================================

        const {
            data: {
                user
            },
            error: userError
        } = await supabase.auth.getUser();


        if (userError || !user) {

            alert(
                "Unable to verify your account."
            );

            return;

        }


        try {

            setChangingPassword(true);


            // ======================================
            // VERIFY CURRENT PASSWORD
            // ======================================

            const {
                error: signInError
            } = await supabase.auth.signInWithPassword({

                email:
                    user.email,

                password:
                    currentPassword

            });


            if (signInError) {

                alert(
                    "Current password is incorrect."
                );

                return;

            }


            // ======================================
            // UPDATE PASSWORD
            // ======================================

            const {
                error: updateError
            } = await supabase.auth.updateUser({

                password:
                    newPassword

            });


            if (updateError) {

                throw updateError;

            }


            // ======================================
            // LOG OUT OTHER DEVICES
            // ======================================

            if (logoutOtherDevices) {

                const {
                    error: sessionError
                } = await supabase.auth.signOut({
                    scope: "others"
                });


                if (sessionError) {

                    console.error(
                        "Failed to sign out other devices:",
                        sessionError
                    );

                }

            }


            // ======================================
            // RESET FORM
            // ======================================

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setLogoutOtherDevices(false);


            alert(
                "Password changed successfully!"
            );


        } catch (error) {

            console.error(
                "Change password error:",
                error
            );


            alert(
                error.message ||
                "Failed to change password."
            );


        } finally {

            setChangingPassword(false);

        }

    }


    // ==========================================
    // LOAD PROFILE
    // ==========================================

    useEffect(() => {

        loadProfile();

    }, []);


    async function loadProfile() {

        try {

            setLoading(true);


            // ======================================
            // GET AUTH USER
            // ======================================

            const {
                data: { user },
                error: authError
            } = await supabase.auth.getUser();


            if (authError) {

                throw authError;

            }


            if (!user) {

                alert(
                    "No authenticated user found."
                );

                return;

            }


            // ======================================
            // GET SYSTEM USER
            // ======================================

            const {
                data: userData,
                error: userError
            } = await supabase

                .from("users")

                .select("*")

                .eq(
                    "auth_id",
                    user.id
                )

                .single();


            if (userError) {

                throw userError;

            }


            if (!userData) {

                alert(
                    "User information not found."
                );

                return;

            }


            setInfos(userData);

            // ======================================
            // LOAD NOTIFICATION PREFERENCES
            // ======================================

            await loadNotificationPreferences(
                userData.id
            );


            // ======================================
            // GET USER DETAILS
            // ======================================

            if (!userData.detail_id) {

                console.log(
                    "User has no detail_id."
                );

                setOtherInfos(null);

                return;

            }


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

                throw detailError;

            }


            setOtherInfos(detailData);


        } catch (error) {

            console.error(
                "Load settings profile error:",
                error
            );


            alert(
                error.message ||
                "Failed to load account information."
            );


        } finally {

            setLoading(false);

        }

    }


    // ==========================================
    // LOAD NOTIFICATION PREFERENCES
    // ==========================================

    async function loadNotificationPreferences(userId) {

        try {

            setLoadingNotifications(true);


            // ======================================
            // GET EXISTING PREFERENCES
            // ======================================

            const {
                data,
                error
            } = await supabase

                .from("notification_preferences")

                .select("*")

                .eq(
                    "user_id",
                    userId
                )

                .maybeSingle();


            if (error) {

                throw error;

            }


            // ======================================
            // CREATE DEFAULT PREFERENCES
            // ======================================

            if (!data) {

                const {
                    data: newPreferences,
                    error: insertError
                } = await supabase

                    .from("notification_preferences")

                    .insert({

                        user_id:
                            userId,

                        schedule_notifications:
                            true,

                        material_notifications:
                            true,

                        assignment_notifications:
                            true,

                        grading_notifications:
                            true,

                        payment_notifications:
                            true,

                        system_notifications:
                            true

                    })

                    .select()

                    .single();


                if (insertError) {

                    throw insertError;

                }


                setNotificationPreferences(
                    newPreferences
                );


                return;

            }


            setNotificationPreferences(data);


        } catch (error) {

            console.error(
                "Load notification preferences error:",
                error
            );


            alert(
                error.message ||
                "Failed to load notification preferences."
            );


        } finally {

            setLoadingNotifications(false);

        }

    }


    // ==========================================
    // NOTIFICATION PREFERENCE CHANGE
    // ==========================================

    function handleNotificationPreferenceChange(
        name,
        value
    ) {

        setNotificationPreferences(previous => ({

            ...previous,

            [name]: value

        }));

    }


    // ==========================================
    // SAVE NOTIFICATION PREFERENCES
    // ==========================================

    async function handleSaveNotificationPreferences() {

        if (!notificationPreferences) {

            alert(
                "Notification preferences are not loaded yet."
            );

            return;

        }


        try {

            setSavingNotifications(true);


            const {
                error
            } = await supabase

                .from("notification_preferences")

                .update({

                    schedule_notifications:
                        notificationPreferences.schedule_notifications,

                    material_notifications:
                        notificationPreferences.material_notifications,

                    assignment_notifications:
                        notificationPreferences.assignment_notifications,

                    grading_notifications:
                        notificationPreferences.grading_notifications,

                    payment_notifications:
                        notificationPreferences.payment_notifications,

                    system_notifications:
                        notificationPreferences.system_notifications,

                    updated_at:
                        new Date().toISOString()

                })

                .eq(
                    "user_id",
                    notificationPreferences.user_id
                );


            if (error) {

                throw error;

            }


            alert(
                "Notification preferences saved successfully!"
            );


        } catch (error) {

            console.error(
                "Save notification preferences error:",
                error
            );


            alert(
                error.message ||
                "Failed to save notification preferences."
            );


        } finally {

            setSavingNotifications(false);

        }

    }

    // ==========================================
    // TOGGLE SECTION
    // ==========================================

    function toggleSection(section) {

        setOpenSection(
            previous =>
                previous === section
                    ? null
                    : section
        );

    }


    // ==========================================
    // USER INFORMATION CHANGE
    // ==========================================

    function handleInfoChange(event) {

        const {
            name,
            value
        } = event.target;


        setInfos(previous => ({

            ...previous,

            [name]: value

        }));

    }


    // ==========================================
    // USER DETAILS CHANGE
    // ==========================================

    function handleOtherInfoChange(event) {

        const {
            name,
            value
        } = event.target;


        setOtherInfos(previous => ({

            ...previous,

            [name]: value

        }));

    }


    // ==========================================
    // PROFILE IMAGE CHANGE
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
    // UPLOAD PROFILE IMAGE
    // ==========================================

    async function uploadProfileImage() {

        // No new image
        if (!imageFile) {

            return (
                otherInfos?.profile_url ||
                null
            );

        }


        const file =
            imageFile;


        const fileExt =
            file.name
                .split(".")
                .pop();


        const fileName =
            `${crypto.randomUUID()}.${fileExt}`;


        const filePath =
            `profiles/${fileName}`;


        const {
            error: uploadError
        } = await supabase
        .storage

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
    // SAVE ACCOUNT SETTINGS
    // ==========================================

    async function handleSaveAccount() {

        if (!infos || !otherInfos) {

            alert(
                "Account information is not loaded yet."
            );

            return;

        }


        // ======================================
        // BASIC VALIDATION
        // ======================================

        if (
            !infos.Name?.trim() ||
            !infos.Email?.trim()
        ) {

            alert(
                "Fill up all required fields."
            );

            return;

        }


        const confirmed =
            window.confirm(
                "Are you sure you want to save your account changes?"
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
                        infos.Email

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

                    Subjects:
                        otherInfos.Subjects,

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
            // UPDATE LOCAL IMAGE
            // ======================================

            setOtherInfos(previous => ({

                ...previous,

                profile_url:
                    imageUrl

            }));


            setImageFile(null);


            alert(
                "Account settings saved successfully!"
            );


        } catch (error) {

            console.error(
                "Save account settings error:",
                error
            );


            alert(
                error.message ||
                "Failed to save account settings."
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

            <div className="settings-page">

                <div className="settings-header">

                    <h1>
                        Settings
                    </h1>

                    <p>
                        Loading account information...
                    </p>

                </div>

            </div>

        );

    }


    // ==========================================
    // USER NOT FOUND
    // ==========================================

    if (!infos) {

        return (

            <div className="settings-page">

                <div className="settings-header">

                    <h1>
                        Settings
                    </h1>

                    <p>
                        Unable to load your account information.
                    </p>

                </div>

            </div>

        );

    }


    // ==========================================
    // RENDER
    // ==========================================

    return (

        <div className="settings-page">


            {/* ==================================
                HEADER
            ================================== */}

            <div className="settings-header">

                <h1>
                    Settings
                </h1>

                <p>
                    Manage your account, security,
                    and notification preferences.
                </p>

            </div>


            {/* ==================================
                ACCOUNT SETTINGS
            ================================== */}

            <div className="settings-section">

                <button
                    className="settings-section-header"
                    onClick={() =>
                        toggleSection("account")
                    }
                >

                    <span>
                        Account Settings
                    </span>

                    <span>
                        {openSection === "account"
                            ? "▲"
                            : "▼"
                        }
                    </span>

                </button>


                {openSection === "account" && (

                    <div className="settings-section-content">


                        <h3>
                            Account Information
                        </h3>


                        {/* ==================================
                            PROFILE PICTURE
                        ================================== */}

                        <div className="settings-profile-picture">

                            <img
                                src={
                                    image ||
                                    otherInfos?.profile_url ||
                                    "https://placehold.co/150x150?text=Profile"
                                }
                                alt="Profile"
                            />


                            <div>

                                <label>
                                    Profile Picture
                                </label>


                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={
                                        handleImageChange
                                    }
                                    disabled={saving}
                                />

                            </div>

                        </div>


                        {/* ==================================
                            COMMON INFORMATION
                        ================================== */}

                        <div className="settings-form-grid">


                            {/* FULL NAME */}

                            <div className="settings-field">

                                <label>
                                    Full Name
                                </label>

                                <input
                                    type="text"
                                    name="Name"
                                    value={
                                        infos.Name || ""
                                    }
                                    onChange={
                                        handleInfoChange
                                    }
                                    disabled={saving}
                                />

                            </div>


                            {/* EMAIL */}

                            <div className="settings-field">

                                <label>
                                    Email
                                </label>

                                <input
                                    type="email"
                                    name="Email"
                                    value={
                                        infos.Email || ""
                                    }
                                    onChange={
                                        handleInfoChange
                                    }
                                    disabled={saving}
                                />

                            </div>


                            {/* DATE OF BIRTH */}

                            <div className="settings-field">

                                <label>
                                    Date of Birth
                                </label>

                                <input
                                    type="date"
                                    name="date_of_birth"
                                    value={
                                        otherInfos?.date_of_birth ||
                                        ""
                                    }
                                    onChange={
                                        handleOtherInfoChange
                                    }
                                    disabled={saving}
                                />

                            </div>


                            {/* SCHOOL */}

                            {(infos.Role === "Student" ||
                                infos.Role === "Tutor") && (

                                <div className="settings-field">

                                    <label>
                                        School
                                    </label>

                                    <input
                                        type="text"
                                        name="school"
                                        value={
                                            otherInfos?.school ||
                                            ""
                                        }
                                        onChange={
                                            handleOtherInfoChange
                                        }
                                        disabled={saving}
                                    />

                                </div>

                            )}


                            {/* ADDRESS */}

                            <div className="settings-field">

                                <label>
                                    Address
                                </label>

                                <input
                                    type="text"
                                    name="Address"
                                    value={
                                        otherInfos?.Address ||
                                        ""
                                    }
                                    onChange={
                                        handleOtherInfoChange
                                    }
                                    disabled={saving}
                                />

                            </div>


                            {/* PHONE */}

                            <div className="settings-field">

                                <label>
                                    Phone Number
                                </label>

                                <input
                                    type="text"
                                    name="phone_number"
                                    value={
                                        otherInfos?.phone_number ||
                                        ""
                                    }
                                    onChange={
                                        handleOtherInfoChange
                                    }
                                    disabled={saving}
                                />

                            </div>


                            {/* ==================================
                                STUDENT ONLY
                            ================================== */}

                            {infos.Role === "Student" && (

                                <>

                                    <div className="settings-field">

                                        <label>
                                            Grade Level
                                        </label>

                                        <input
                                            type="text"
                                            name="Grade_Level"
                                            value={
                                                otherInfos?.Grade_Level ||
                                                ""
                                            }
                                            onChange={
                                                handleOtherInfoChange
                                            }
                                            disabled={saving}
                                        />

                                    </div>


                                </>

                            )}




                            {/* ==================================
                                ROLE
                            ================================== */}

                            <div className="settings-field">

                                <label>
                                    Account Role
                                </label>

                                <input
                                    type="text"
                                    value={
                                        infos.Role || ""
                                    }
                                    disabled
                                />

                            </div>


                        </div>


                        {/* ==================================
                            SAVE
                        ================================== */}

                        <div className="settings-save-box">

                            <button
                                onClick={
                                    handleSaveAccount
                                }
                                disabled={saving}
                            >

                                {saving
                                    ? "Saving..."
                                    : "Save Changes"
                                }

                            </button>

                        </div>


                    </div>

                )}

            </div>


            {/* ==================================
                SECURITY SETTINGS
            ================================== */}

            <div className="settings-section">

                <button
                    className="settings-section-header"
                    onClick={() =>
                        toggleSection("security")
                    }
                >

                    <span>
                        Security Settings
                    </span>

                    <span>
                        {openSection === "security"
                            ? "▲"
                            : "▼"
                        }
                    </span>

                </button>


                {openSection === "security" && (

                    <div className="settings-section-content">

                        <h3>
                            Change Password
                        </h3>


                        <div className="security-form">


                            {/* ==================================
                                CURRENT PASSWORD
                            ================================== */}

                            <div className="settings-field">

                                <label>
                                    Current Password
                                </label>

                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={(event) =>
                                        setCurrentPassword(
                                            event.target.value
                                        )
                                    }
                                    disabled={changingPassword}
                                    autoComplete="current-password"
                                />

                            </div>


                            {/* ==================================
                                NEW PASSWORD
                            ================================== */}

                            <div className="settings-field">

                                <label>
                                    New Password
                                </label>

                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(event) =>
                                        setNewPassword(
                                            event.target.value
                                        )
                                    }
                                    disabled={changingPassword}
                                    autoComplete="new-password"
                                />

                            </div>


                            {/* ==================================
                                CONFIRM PASSWORD
                            ================================== */}

                            <div className="settings-field">

                                <label>
                                    Confirm New Password
                                </label>

                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(event) =>
                                        setConfirmPassword(
                                            event.target.value
                                        )
                                    }
                                    disabled={changingPassword}
                                    autoComplete="new-password"
                                />

                            </div>


                            {/* ==================================
                                LOG OUT OTHER DEVICES
                            ================================== */}

                            <div className="security-checkbox">

                                <label>

                                    <input
                                        type="checkbox"
                                        checked={logoutOtherDevices}
                                        onChange={(event) =>
                                            setLogoutOtherDevices(
                                                event.target.checked
                                            )
                                        }
                                        disabled={changingPassword}
                                    />

                                    <span>
                                        Log out all other devices
                                    </span>

                                </label>

                            </div>


                            {/* ==================================
                                CHANGE PASSWORD BUTTON
                            ================================== */}

                            <div className="settings-save-box">

                                <button
                                    onClick={
                                        handleChangePassword
                                    }
                                    disabled={
                                        changingPassword
                                    }
                                >

                                    {changingPassword
                                        ? "Changing Password..."
                                        : "Change Password"
                                    }

                                </button>

                            </div>


                        </div>

                    </div>

                )}

            </div>


            {/* ==================================
                NOTIFICATION SETTINGS
            ================================== */}

            <div className="settings-section">

                <button
                    className="settings-section-header"
                    onClick={() =>
                        toggleSection("notifications")
                    }
                >

                    <span>
                        Notification Settings
                    </span>

                    <span>
                        {openSection === "notifications"
                            ? "▲"
                            : "▼"
                        }
                    </span>

                </button>


                {openSection === "notifications" && (

                    <div className="settings-section-content">

                    <h3>
                        Notification Preferences
                    </h3>

                    <p>
                        Choose which notifications you want
                        to receive.
                    </p>


                    {loadingNotifications ? (

                        <p>
                            Loading notification preferences...
                        </p>

                    ) : notificationPreferences ? (

                        <div className="notification-preferences">


                            {/* ==================================
                                SCHEDULE
                            ================================== */}

                            <div className="notification-preference-item">

                                <div>

                                    <strong>
                                        Schedule Notifications
                                    </strong>

                                    <p>
                                        Receive notifications about
                                        your tutoring schedules,
                                        schedule requests, approvals,
                                        and changes.
                                    </p>

                                </div>


                                <input
                                    type="checkbox"
                                    checked={
                                        notificationPreferences
                                            .schedule_notifications
                                    }
                                    onChange={(event) =>
                                        handleNotificationPreferenceChange(
                                            "schedule_notifications",
                                            event.target.checked
                                        )
                                    }
                                    disabled={savingNotifications}
                                />

                            </div>


                            {/* ==================================
                                MATERIALS
                            ================================== */}

                            <div className="notification-preference-item">

                                <div>

                                    <strong>
                                        Learning Material Notifications
                                    </strong>

                                    <p>
                                        Receive notifications when new
                                        learning materials are assigned
                                        to you.
                                    </p>

                                </div>


                                <input
                                    type="checkbox"
                                    checked={
                                        notificationPreferences
                                            .material_notifications
                                    }
                                    onChange={(event) =>
                                        handleNotificationPreferenceChange(
                                            "material_notifications",
                                            event.target.checked
                                        )
                                    }
                                    disabled={savingNotifications}
                                />

                            </div>


                            {/* ==================================
                                ASSIGNMENTS
                            ================================== */}

                            <div className="notification-preference-item">

                                <div>

                                    <strong>
                                        Assignment Notifications
                                    </strong>

                                    <p>
                                        Receive notifications about
                                        assignments and assignment
                                        updates.
                                    </p>

                                </div>


                                <input
                                    type="checkbox"
                                    checked={
                                        notificationPreferences
                                            .assignment_notifications
                                    }
                                    onChange={(event) =>
                                        handleNotificationPreferenceChange(
                                            "assignment_notifications",
                                            event.target.checked
                                        )
                                    }
                                    disabled={savingNotifications}
                                />

                            </div>


                            {/* ==================================
                                GRADING
                            ================================== */}

                            <div className="notification-preference-item">

                                <div>

                                    <strong>
                                        Grading Notifications
                                    </strong>

                                    <p>
                                        Receive notifications when an
                                        assignment has been graded or
                                        updated.
                                    </p>

                                </div>


                                <input
                                    type="checkbox"
                                    checked={
                                        notificationPreferences
                                            .grading_notifications
                                    }
                                    onChange={(event) =>
                                        handleNotificationPreferenceChange(
                                            "grading_notifications",
                                            event.target.checked
                                        )
                                    }
                                    disabled={savingNotifications}
                                />

                            </div>


                            {/* ==================================
                                PAYMENT
                            ================================== */}

                            <div className="notification-preference-item">

                                <div>

                                    <strong>
                                        Payment Notifications
                                    </strong>

                                    <p>
                                        Receive notifications about
                                        payments, subscriptions,
                                        and payment updates.
                                    </p>

                                </div>


                                <input
                                    type="checkbox"
                                    checked={
                                        notificationPreferences
                                            .payment_notifications
                                    }
                                    onChange={(event) =>
                                        handleNotificationPreferenceChange(
                                            "payment_notifications",
                                            event.target.checked
                                        )
                                    }
                                    disabled={savingNotifications}
                                />

                            </div>


                            {/* ==================================
                                SYSTEM
                            ================================== */}

                            <div className="notification-preference-item">

                                <div>

                                    <strong>
                                        System Notifications
                                    </strong>

                                    <p>
                                        Receive important system and
                                        account notifications.
                                    </p>

                                </div>


                                <input
                                    type="checkbox"
                                    checked={
                                        notificationPreferences
                                            .system_notifications
                                    }
                                    onChange={(event) =>
                                        handleNotificationPreferenceChange(
                                            "system_notifications",
                                            event.target.checked
                                        )
                                    }
                                    disabled={savingNotifications}
                                />

                            </div>


                            {/* ==================================
                                SAVE
                            ================================== */}

                            <div className="settings-save-box">

                                <button
                                    onClick={
                                        handleSaveNotificationPreferences
                                    }
                                    disabled={
                                        savingNotifications
                                    }
                                >

                                    {savingNotifications
                                        ? "Saving..."
                                        : "Save Notification Preferences"
                                    }

                                </button>

                            </div>


                        </div>

                    ) : (

                        <p>
                            Unable to load notification preferences.
                        </p>

                    )}

                </div>

                )}

            </div>

            {/* 
            ///////////////////
                 logout 
            //////////////////
            */}

            <div id="LogOut-Container">
                
                <button
                    onClick={handleLogout}
                >
                    Log Out
                </button>


            </div>


        </div>

    );

}

export default MainSettings;