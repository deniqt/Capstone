import { useEffect, useState } from 'react';
import './adminSAT.css';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

function AdminSAT() {

    // ==========================================
    // USER DATA
    // ==========================================

    const [students, setStudents] = useState([]);
    const [tutors, setTutors] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [users, setUsers] = useState([]);

    const [tableActive, setTableActive] = useState("All");

    const navigate = useNavigate();


    // ==========================================
    // ADD USER MODAL
    // ==========================================

    const [showAddModal, setShowAddModal] = useState(false);

    const [addUserType, setAddUserType] = useState("Student");

    const [saving, setSaving] = useState(false);


    // ==========================================
    // FORM DATA
    // ==========================================

    const [formData, setFormData] = useState({

        // Personal Information
        profilePicture: null,
        fullName: "",
        dateOfBirth: "",
        school: "",
        phoneNumber: "",
        address: "",

        // Guardian Information
        guardianName: "",
        guardianEmail: "",
        guardianRelationship: "",
        guardianPhone: "",

        // Account Settings
        email: "",
        password: "",
        tutorId: "",
        gradeLevel: ""

    });


    // ==========================================
    // PROFILE PREVIEW
    // ==========================================

    const [profilePreview, setProfilePreview] =
        useState(null);


    // ==========================================
    // LOAD USERS
    // ==========================================

    useEffect(() => {

        getUsers();
        getStudent();
        getTutors();
        getAdmins();
        getProfileImages();

    }, []);


    async function getUsers() {
        const { data, error } = await supabase
            .from("users")
            .select("*")
            .order("id", {
                ascending: false
            });

        if (error) {
            console.error("Users loading error:", error);
            return;
        }

        setUsers(data || []);
    }


    async function getStudent() {
        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("Role", "Student")
            .order("id", {
                ascending: false
            });

        if (error) {
            console.error("Students loading error:", error);
            return;
        }

        setStudents(data || []);
    }


    async function getTutors() {
        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("Role", "Tutor")
            .order("Name", {
                ascending: true
            });

        if (error) {
            console.error("Tutors loading error:", error);
            return;
        }

        setTutors(data || []);
    }


    async function getAdmins() {
        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("Role", "Admin")
            .order("id", {
                ascending: false
            });

        if (error) {
            console.error("Admins loading error:", error);
            return;
        }

        setAdmins(data || []);
    }


    const [profileImages, setProfileImages] = useState({});
    async function getProfileImages() {
        const { data, error } = await supabase
            .from("user_details")
            .select("detail_id, profile_url");

        if (error) {
            console.error(
                "Profile images loading error:",
                error
            );
            return;
        }

        const detailsMap = {};

        data?.forEach(detail => {
            detailsMap[detail.detail_id] =
                detail.profile_url;
        });

        setProfileImages(detailsMap);
    }

    // ==========================================
    // OPEN ADD MODAL
    // ==========================================

    function openAddModal(type) {

        setAddUserType(type);

        resetForm();

        setShowAddModal(true);

    }


    // ==========================================
    // CLOSE MODAL
    // ==========================================

    function closeAddModal() {

        if (saving) {
            return;
        }

        setShowAddModal(false);

        resetForm();

    }


    // ==========================================
    // RESET FORM
    // ==========================================

    function resetForm() {

        setFormData({

            profilePicture: null,

            fullName: "",
            dateOfBirth: "",
            school: "",
            phoneNumber: "",
            address: "",

            guardianName: "",
            guardianEmail: "",
            guardianRelationship: "",
            guardianPhone: "",

            email: "",
            password: "",
            tutorId: "",
            gradeLevel: ""

        });

        setProfilePreview(null);

    }


    // ==========================================
    // FORM CHANGE
    // ==========================================

    function handleChange(event) {

        const {
            name,
            value
        } = event.target;

        setFormData(prev => ({

            ...prev,

            [name]: value

        }));

    }


    // ==========================================
    // PROFILE PICTURE
    // ==========================================

    function handleProfilePicture(event) {

        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }

        setFormData(prev => ({

            ...prev,

            profilePicture: file

        }));

        setProfilePreview(
            URL.createObjectURL(file)
        );

    }


    // ==========================================
    // VALIDATION
    // ==========================================

    function validateForm() {

        if (
            !formData.fullName.trim() ||
            !formData.dateOfBirth ||
            !formData.email.trim() ||
            !formData.password.trim()
        ) {

            alert(
                "Fill up all required fields."
            );

            return false;

        }


        // ======================================
        // STUDENT VALIDATION
        // ======================================

        if (addUserType === "Student") {

            if (
                !formData.guardianName.trim() ||
                !formData.guardianEmail.trim() ||
                !formData.guardianRelationship.trim() ||
                !formData.guardianPhone.trim() ||
                !formData.gradeLevel.trim()
            ) {

                alert(
                    "Fill up all required student fields."
                );

                return false;

            }

        }


        // ======================================
        // TUTOR / ADMIN PHONE
        // ======================================

        if (
            (
                addUserType === "Tutor" ||
                addUserType === "Admin"
            ) &&
            !formData.phoneNumber.trim()
        ) {

            alert(
                "Phone Number is required."
            );

            return false;

        }


        // ======================================
        // EMAIL FORMAT
        // ======================================

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


        if (
            !emailPattern.test(
                formData.email
            )
        ) {

            alert(
                "Please enter a valid email address."
            );

            return false;

        }


        // ======================================
        // GUARDIAN EMAIL
        // ======================================

        if (
            addUserType === "Student" &&
            !emailPattern.test(
                formData.guardianEmail
            )
        ) {

            alert(
                "Please enter a valid guardian email address."
            );

            return false;

        }


        // ======================================
        // PASSWORD
        // ======================================

        if (
            formData.password.length < 6
        ) {

            alert(
                "Password must be at least 6 characters."
            );

            return false;

        }


        return true;

    }


    // ==========================================
    // ADD USER
    // ==========================================

    async function handleAddUser(event) {

        event.preventDefault();


        if (!validateForm()) {
            return;
        }


        setSaving(true);


        try {

            /*
             * IMPORTANT:
             *
             * We should NOT create the Auth account
             * directly from this React component using
             * the Supabase service-role key.
             *
             * The secure version will call a Supabase
             * Edge Function.
             */

            let profileUrl = null;

            if (formData.profilePicture) {

                const file =
                    formData.profilePicture;

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
                    data: publicUrlData
                } = supabase.storage
                    .from("profiles")
                    .getPublicUrl(
                        filePath
                    );


                profileUrl =
                    publicUrlData.publicUrl;

            }


            const {
                data,
                error
            } = await supabase.functions.invoke(
                "create-user",
                {
                    body: {

                        userType:
                            addUserType,

                        fullName:
                            formData.fullName,

                        dateOfBirth:
                            formData.dateOfBirth,

                        school:
                            formData.school,

                        phoneNumber:
                            formData.phoneNumber,

                        address:
                            formData.address,

                        guardianName:
                            formData.guardianName,

                        guardianEmail:
                            formData.guardianEmail,

                        guardianRelationship:
                            formData.guardianRelationship,

                        guardianPhone:
                            formData.guardianPhone,

                        email:
                            formData.email,

                        password:
                            formData.password,

                        tutorId:
                            formData.tutorId ||
                            null,

                        profileUrl: profileUrl,

                        gradeLevel:
                            formData.gradeLevel ||
                            null

                        
                    }
                }
            );


            if (error) {
                throw error;
            }


            if (
                data?.error
            ) {

                throw new Error(
                    data.error
                );

            }


            alert(
                `${addUserType} account created successfully.`
            );


            setShowAddModal(false);

            resetForm();


            // Refresh tables

            await Promise.all([

                getUsers(),

                getStudent(),

                getTutors(),

                getAdmins()

            ]);


        } catch (error) {

            console.error(
                "Add user error:",
                error
            );

            alert(
                error.message ||
                "Failed to create user."
            );

        } finally {

            setSaving(false);

        }

    }


    // ==========================================
    // CURRENT TABLE DATA
    // ==========================================

    function getCurrentUsers() {

        if (
            tableActive === "Student"
        ) {

            return students;

        }

        if (
            tableActive === "Tutor"
        ) {

            return tutors;

        }

        if (
            tableActive === "Admin"
        ) {

            return admins;

        }

        return users;

    }
    // ==========================================
    // PAGINATION
    // ==========================================

    const [currentPage, setCurrentPage] = useState(1);

    const usersPerPage = 7;


    // ==========================================
    // PAGINATION DATA
    // ==========================================

    const currentUsers = getCurrentUsers();

    const totalPages = Math.ceil(
        currentUsers.length / usersPerPage
    );

    const startIndex =
        (currentPage - 1) * usersPerPage;

    const endIndex =
        startIndex + usersPerPage;

    const paginatedUsers =
        currentUsers.slice(
            startIndex,
            endIndex
        );


    // ==========================================
    // USER INITIAL
    // ==========================================

    function getUserInitial(name) {
        if (!name || !name.trim()) {
            return "?";
        }

        return name.trim().charAt(0).toUpperCase();
    }    

    // ==========================================
    // FORMAT DATE
    // ==========================================

    function formatDate(date) {

        if (!date) {
            return "—";
        }

        return new Date(date).toLocaleDateString(
            "en-US",
            {
                month: "short",
                day: "numeric",
                year: "numeric"
            }
        );

    }


    // ==========================================
    // EXPORT CSV
    // ==========================================
    function exportCSV() {
        const data = getCurrentUsers();

        if (!data || data.length === 0) {
            alert("No users to export.");
            return;
        }

        // CSV columns
        const headers = [
            "ID",
            "Name",
            "Email",
            "Role",
            "Joined Date",
            "Status"
        ];

        // Convert users into CSV rows
        const rows = data.map(user => [
            user.id ?? "",
            user.Name ?? "",
            user.Email ?? "",
            user.Role ?? "",
            user.Joined
                ? new Date(user.Joined).toLocaleDateString("en-US")
                : "",
            user.Status ?? ""
        ]);

        // Escape CSV values
        const escapeCSV = value => {
            const stringValue = String(value);

            if (
                stringValue.includes(",") ||
                stringValue.includes('"') ||
                stringValue.includes("\n")
            ) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }

            return stringValue;
        };

        const csvContent = [
            headers.map(escapeCSV).join(","),
            ...rows.map(row =>
                row.map(escapeCSV).join(",")
            )
        ].join("\n");

        // Create downloadable file
        const blob = new Blob(
            [csvContent],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;

        link.download = `${tableActive.toLowerCase()}-users.csv`;

        document.body.appendChild(link);
        link.click();

        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
   


    // ==========================================
    // RENDER
    // ==========================================

    return (

        <div className="admin-sat-page">


            {/* ==================================
                HEADER
            ================================== */}

            <div className="sat-header">

                    <h1 id="SATTitle">
                        Student & Teacher
                    </h1>

                {/* ==================================
                    ADD BUTTONS
                ================================== */}

                <div className="sat-add-buttons">

                     <button
                        className="export-csv-button"
                        onClick={exportCSV}
                    >
                        Export CSV
                    </button>

                    <button
                        className="add-user-button"
                        onClick={() =>
                            openAddModal(
                                "Student"
                            )
                        }
                    >
                        +  Add Student
                    </button>


                    <button
                        className="add-user-button"
                        onClick={() =>
                            openAddModal(
                                "Tutor"
                            )
                        }
                    >
                        +  Add Tutor
                    </button>


                    <button
                        className="add-user-button"
                        onClick={() =>
                            openAddModal(
                                "Admin"
                            )
                        }
                    >
                        +  Add Admin
                    </button>

                   

                </div>

            </div>


            {/* ==================================
                TABLE
            ================================== */}

            <div className="TableBox">


                <div className="TableHead">

                    <button
                        className={
                            `TableOption ${
                                tableActive === "All"
                                    ? "active"
                                    : ""
                            }`
                        }
                        onClick={() =>{
                             setTableActive("All");
                            setCurrentPage(1);
                        }
                        }
                    >
                        All Users
                    </button>


                    <button
                        className={
                            `TableOption ${
                                tableActive === "Student"
                                    ? "active"
                                    : ""
                            }`
                        }
                        onClick={() =>{
                             setTableActive("Student");
                            setCurrentPage(1);
                        }

                        }
                    >
                        Students
                    </button>


                    <button
                        className={
                            `TableOption ${
                                tableActive === "Tutor"
                                    ? "active"
                                    : ""
                            }`
                        }
                        onClick={() =>
                            {   
                                setTableActive("Tutor");
                                setCurrentPage(1);
                            }
                        }
                    >
                        Tutors
                    </button>


                    <button
                        className={
                            `TableOption ${
                                tableActive === "Admin"
                                    ? "active"
                                    : ""
                            }`
                        }
                        onClick={() =>
                            {
                                setTableActive("Admin")
                                setCurrentPage(1);
                            }
                            
                        }
                    >
                        Admins
                    </button>

                </div>


                <div className="mainTable">

                    <table className="user-table">

                        <thead>

                            <tr>

                                <th>
                                    USER
                                </th>

                                <th>
                                    Role
                                </th>

                                <th>
                                    Joined Date
                                </th>

                                <th>
                                    Status
                                </th>

                                <th>
                                    Action
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            {paginatedUsers.length === 0 ? (

                                <tr>

                                    <td
                                        colSpan="5"
                                        style={{
                                            textAlign:
                                                "center"
                                        }}
                                    >
                                        No users found.
                                    </td>

                                </tr>

                            ) : (

                                paginatedUsers.map(
                                    user => (

                                        <tr
                                            key={user.id}
                                        >

                                            <td>
                                                <div className="user-info">

                                                    <div className="user-avatar">

                                                        {profileImages[user.detail_id] ? (
                                                            <img
                                                            src={profileImages[user.detail_id]}
                                                            alt={user.Name || "User"}
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = "none";
                                                            }}
                                                        />
                                                        ) : (
                                                            <span>
                                                                {getUserInitial(user.Name)}
                                                            </span>
                                                        )}

                                                    </div>

                                                    <span className="user-name">
                                                        {user.Name || "Unnamed User"}
                                                    </span>

                                                </div>
                                            </td>


                                            <td>
                                                {
                                                    user.Role
                                                }
                                            </td>


                                           <td>
                                                {formatDate(user.Joined)}
                                            </td>


                                            <td>
                                                {
                                                    user.Status
                                                }
                                            </td>


                                            <td>

                                                <button
                                                    onClick={() =>
                                                        navigate(
                                                            `/admin/EditProfile/${user.id}`
                                                        )
                                                    }
                                                >
                                                    Edit
                                                </button>

                                            </td>

                                        </tr>

                                    )
                                )

                            )}

                        </tbody>

                    </table>
                    {/* ==================================
                        PAGINATION
                    ================================== */}
                    {totalPages > 0 && (
                        <div className="pagination-container">

                            {/* LEFT SIDE - SHOWING INFO */}
                            <div className="pagination-info">
                                Showing{" "}
                                {currentUsers.length === 0
                                    ? 0
                                    : startIndex + 1}{" "}
                                to{" "}
                                {Math.min(
                                    endIndex,
                                    currentUsers.length
                                )}{" "}
                                of{" "}
                                {currentUsers.length} users
                            </div>

                            {/* RIGHT SIDE - PAGINATION */}
                            {totalPages > 1 && (
                                <div className="pagination">

                                    {/* PREVIOUS */}
                                    <button
                                        className="pagination-button"
                                        disabled={currentPage === 1}
                                        onClick={() =>
                                            setCurrentPage(
                                                prev => prev - 1
                                            )
                                        }
                                    >
                                        &lt;
                                    </button>

                                    <div className="pagination-pages">

                                        {/* PAGE 1 */}
                                        <button
                                            className={`pagination-number ${
                                                currentPage === 1
                                                    ? "active"
                                                    : ""
                                            }`}
                                            onClick={() =>
                                                setCurrentPage(1)
                                            }
                                        >
                                            1
                                        </button>

                                        {/* PAGE 2 */}
                                        {totalPages >= 2 && (
                                            <button
                                                className={`pagination-number ${
                                                    currentPage === 2
                                                        ? "active"
                                                        : ""
                                                }`}
                                                onClick={() =>
                                                    setCurrentPage(2)
                                                }
                                            >
                                                2
                                            </button>
                                        )}

                                        {/* DOTS */}
                                        {totalPages > 3 && (
                                            <span className="pagination-dots">
                                                ...
                                            </span>
                                        )}

                                        {/* LAST PAGE */}
                                        {totalPages >= 3 && (
                                            <button
                                                className={`pagination-number ${
                                                    currentPage === totalPages
                                                        ? "active"
                                                        : ""
                                                }`}
                                                onClick={() =>
                                                    setCurrentPage(
                                                        totalPages
                                                    )
                                                }
                                            >
                                                {totalPages}
                                            </button>
                                        )}

                                    </div>

                                    {/* NEXT */}
                                    <button
                                        className="pagination-button"
                                        disabled={
                                            currentPage === totalPages
                                        }
                                        onClick={() =>
                                            setCurrentPage(
                                                prev => prev + 1
                                            )
                                        }
                                    >
                                        &gt;
                                    </button>

                                </div>
                            )}

                        </div>
                    )}

                </div>

            </div>


            {/* ==================================
                ADD USER MODAL
            ================================== */}

            {showAddModal && (

                <div
                    className="sat-modal-overlay"
                    onClick={closeAddModal}
                >

                    <div
                        className="sat-modal"
                        onClick={event =>
                            event.stopPropagation()
                        }
                    >


                        {/* HEADER */}

                        <div className="sat-modal-header">

                            <div>

                                <h2>
                                    Add {addUserType}
                                </h2>

                                <p>
                                    Create a new{" "}
                                    {addUserType.toLowerCase()}
                                    {" "}account.
                                </p>

                            </div>


                            <button
                                className="sat-modal-close"
                                onClick={closeAddModal}
                            >
                                ×
                            </button>

                        </div>


                        <form
                            onSubmit={
                                handleAddUser
                            }
                        >


                            {/* ==================================
                                PERSONAL INFORMATION
                            ================================== */}

                            <div className="sat-form-section">

                                <h3>
                                    Personal Information
                                </h3>


                                {/* PROFILE */}

                                <div className="profile-upload">

                                    <div className="profile-preview">

                                        {profilePreview ? (

                                            <img
                                                src={
                                                    profilePreview
                                                }
                                                alt="Preview"
                                            />

                                        ) : (

                                            <span>
                                                📷
                                            </span>

                                        )}

                                    </div>


                                    <div>

                                        <label>
                                            Profile Picture
                                        </label>

                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={
                                                handleProfilePicture
                                            }
                                        />

                                        <small>
                                            Optional
                                        </small>

                                    </div>

                                </div>


                                {/* FULL NAME */}

                                <div className="sat-form-group">

                                    <label>
                                        Full Name *
                                    </label>

                                    <input
                                        type="text"
                                        name="fullName"
                                        value={
                                            formData.fullName
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        placeholder="Enter full name"
                                    />

                                </div>


                                {/* DOB */}

                                <div className="sat-form-group">

                                    <label>
                                        Date of Birth *
                                    </label>

                                    <input
                                        type="date"
                                        name="dateOfBirth"
                                        value={
                                            formData.dateOfBirth
                                        }
                                        onChange={
                                            handleChange
                                        }
                                    />

                                </div>


                                {/* SCHOOL */}

                                <div className="sat-form-group">

                                    <label>
                                        School
                                    </label>

                                    <input
                                        type="text"
                                        name="school"
                                        value={
                                            formData.school
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        placeholder="Optional"
                                    />

                                </div>


                                {/* PHONE */}

                                {(
                                    addUserType === "Tutor" ||
                                    addUserType === "Admin"
                                ) && (

                                    <div className="sat-form-group">

                                        <label>
                                            Phone Number *
                                        </label>

                                        <input
                                            type="tel"
                                            name="phoneNumber"
                                            value={
                                                formData.phoneNumber
                                            }
                                            onChange={
                                                handleChange
                                            }
                                            placeholder="Enter phone number"
                                        />

                                    </div>

                                )}


                                {/* ADDRESS */}

                                <div className="sat-form-group">

                                    <label>
                                        Address
                                    </label>

                                    <textarea
                                        name="address"
                                        value={
                                            formData.address
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        placeholder="Optional"
                                    />

                                </div>

                            </div>


                            {/* ==================================
                                GUARDIAN INFORMATION
                            ================================== */}

                            {addUserType === "Student" && (

                                <div className="sat-form-section">

                                    <h3>
                                        Guardian Information
                                    </h3>


                                    <div className="sat-form-group">

                                        <label>
                                            Guardian Full Name *
                                        </label>

                                        <input
                                            type="text"
                                            name="guardianName"
                                            value={
                                                formData.guardianName
                                            }
                                            onChange={
                                                handleChange
                                            }
                                            placeholder="Enter guardian name"
                                        />

                                    </div>


                                    <div className="sat-form-group">

                                        <label>
                                            Guardian Email *
                                        </label>

                                        <input
                                            type="email"
                                            name="guardianEmail"
                                            value={
                                                formData.guardianEmail
                                            }
                                            onChange={
                                                handleChange
                                            }
                                            placeholder="Enter guardian email"
                                        />

                                    </div>


                                    <div className="sat-form-group">

                                        <label>
                                            Relationship *
                                        </label>

                                        <select
                                            name="guardianRelationship"
                                            value={
                                                formData.guardianRelationship
                                            }
                                            onChange={
                                                handleChange
                                            }
                                        >

                                            <option value="">
                                                Select relationship
                                            </option>

                                            <option value="Parent">
                                                Parent
                                            </option>

                                            <option value="Mother">
                                                Mother
                                            </option>

                                            <option value="Father">
                                                Father
                                            </option>

                                            <option value="Guardian">
                                                Guardian
                                            </option>

                                            <option value="Grandparent">
                                                Grandparent
                                            </option>

                                            <option value="Other">
                                                Other
                                            </option>

                                        </select>

                                    </div>


                                    <div className="sat-form-group">

                                        <label>
                                            Guardian Phone Number *
                                        </label>

                                        <input
                                            type="tel"
                                            name="guardianPhone"
                                            value={
                                                formData.guardianPhone
                                            }
                                            onChange={
                                                handleChange
                                            }
                                            placeholder="Enter guardian phone"
                                        />

                                    </div>

                                </div>

                            )}


                            {/* ==================================
                                ACCOUNT SETTINGS
                            ================================== */}

                            <div className="sat-form-section">

                                <h3>
                                    Account Settings
                                </h3>


                                {/* EMAIL */}

                                <div className="sat-form-group">

                                    <label>
                                        Email *
                                    </label>

                                    <input
                                        type="email"
                                        name="email"
                                        value={
                                            formData.email
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        placeholder="Enter account email"
                                    />

                                </div>


                                {/* PASSWORD */}

                                <div className="sat-form-group">

                                    <label>
                                        Password *
                                    </label>

                                    <input
                                        type="password"
                                        name="password"
                                        value={
                                            formData.password
                                        }
                                        onChange={
                                            handleChange
                                        }
                                        placeholder="Enter password"
                                    />

                                    <small>
                                        Minimum 6 characters
                                    </small>

                                </div>


                                {/* STUDENT ONLY */}

                                {addUserType === "Student" && (

                                    <>

                                        <div className="sat-form-group">

                                            <label>
                                                Tutor
                                            </label>

                                            <select
                                                name="tutorId"
                                                value={
                                                    formData.tutorId
                                                }
                                                onChange={
                                                    handleChange
                                                }
                                            >

                                                <option value="">
                                                    No Tutor
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

                                        </div>


                                        <div className="sat-form-group">

                                            <label>
                                                Grade Level *
                                            </label>

                                            <select
                                                name="gradeLevel"
                                                value={
                                                    formData.gradeLevel
                                                }
                                                onChange={
                                                    handleChange
                                                }
                                            >

                                                <option value="">
                                                    Select Grade Level
                                                </option>

                                                <option value="Grade 1">
                                                    Grade 1
                                                </option>

                                                <option value="Grade 2">
                                                    Grade 2
                                                </option>

                                                <option value="Grade 3">
                                                    Grade 3
                                                </option>

                                                <option value="Grade 4">
                                                    Grade 4
                                                </option>

                                                <option value="Grade 5">
                                                    Grade 5
                                                </option>

                                                <option value="Grade 6">
                                                    Grade 6
                                                </option>

                                                <option value="Grade 7">
                                                    Grade 7
                                                </option>

                                                <option value="Grade 8">
                                                    Grade 8
                                                </option>

                                                <option value="Grade 9">
                                                    Grade 9
                                                </option>

                                                <option value="Grade 10">
                                                    Grade 10
                                                </option>

                                                <option value="Grade 11">
                                                    Grade 11
                                                </option>

                                                <option value="Grade 12">
                                                    Grade 12
                                                </option>

                                            </select>

                                        </div>

                                    </>

                                )}


                                {/* FIXED ROLE */}

                                <div className="sat-form-group">

                                    <label>
                                        Role
                                    </label>

                                    <input
                                        type="text"
                                        value={
                                            addUserType
                                        }
                                        disabled
                                    />

                                </div>

                            </div>


                            {/* ==================================
                                MODAL ACTIONS
                            ================================== */}

                            <div className="sat-modal-actions">

                                <button
                                    type="button"
                                    className="sat-cancel-button"
                                    onClick={
                                        closeAddModal
                                    }
                                    disabled={saving}
                                >
                                    Cancel
                                </button>


                                <button
                                    type="submit"
                                    className="sat-save-button"
                                    disabled={saving}
                                >

                                    {saving
                                        ? "Creating..."
                                        : `Create ${addUserType}`
                                    }

                                </button>

                            </div>

                        </form>

                    </div>

                </div>

            )}

        </div>

    );

}

export default AdminSAT;