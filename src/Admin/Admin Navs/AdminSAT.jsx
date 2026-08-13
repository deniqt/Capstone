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

    }, []);


    async function getUsers() {

        const {
            data,
            error
        } = await supabase
            .from("users")
            .select("*")
            .order("id", {
                ascending: false
            });

        if (error) {

            console.error(
                "Users loading error:",
                error
            );

            return;

        }

        setUsers(data || []);

    }


    async function getStudent() {

        const {
            data,
            error
        } = await supabase
            .from("users")
            .select("*")
            .eq(
                "Role",
                "Student"
            )
            .order("id", {
                ascending: false
            });

        if (error) {

            console.error(
                "Students loading error:",
                error
            );

            return;

        }

        setStudents(data || []);

    }


    async function getTutors() {

        const {
            data,
            error
        } = await supabase
            .from("users")
            .select("*")
            .eq(
                "Role",
                "Tutor"
            )
            .order("Name", {
                ascending: true
            });

        if (error) {

            console.error(
                "Tutors loading error:",
                error
            );

            return;

        }

        setTutors(data || []);

    }


    async function getAdmins() {

        const {
            data,
            error
        } = await supabase
            .from("users")
            .select("*")
            .eq(
                "Role",
                "Admin"
            )
            .order("id", {
                ascending: false
            });

        if (error) {

            console.error(
                "Admins loading error:",
                error
            );

            return;

        }

        setAdmins(data || []);

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
    // RENDER
    // ==========================================

    return (

        <div className="admin-sat-page">


            {/* ==================================
                HEADER
            ================================== */}

            <div className="sat-header">

                <div>

                    <h1 id="SATTitle">
                        Student & Teacher
                    </h1>

                    <p>
                        Manage students, tutors,
                        and administrators.
                    </p>

                </div>


                {/* ==================================
                    ADD BUTTONS
                ================================== */}

                <div className="sat-add-buttons">

                    <button
                        className="add-user-button"
                        onClick={() =>
                            openAddModal(
                                "Student"
                            )
                        }
                    >
                        + Add Student
                    </button>


                    <button
                        className="add-user-button"
                        onClick={() =>
                            openAddModal(
                                "Tutor"
                            )
                        }
                    >
                        + Add Tutor
                    </button>


                    <button
                        className="add-user-button"
                        onClick={() =>
                            openAddModal(
                                "Admin"
                            )
                        }
                    >
                        + Add Admin
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
                        onClick={() =>
                            setTableActive("All")
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
                        onClick={() =>
                            setTableActive("Student")
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
                            setTableActive("Tutor")
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
                            setTableActive("Admin")
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

                            {getCurrentUsers().length === 0 ? (

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

                                getCurrentUsers().map(
                                    user => (

                                        <tr
                                            key={user.id}
                                        >

                                            <td>
                                                {
                                                    user.Name ||
                                                    "Unnamed User"
                                                }
                                            </td>


                                            <td>
                                                {
                                                    user.Role
                                                }
                                            </td>


                                            <td>
                                                {
                                                    user.Joined
                                                }
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