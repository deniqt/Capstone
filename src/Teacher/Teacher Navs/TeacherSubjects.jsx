import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate, useParams } from "react-router-dom";
import {
    FileText,
    Presentation,
    File,
    Film,
    Image,
    ClipboardList,
    Clock,
    AlertCircle,
    CheckCircle2,
    UploadCloud,
    X,
    Trash2,
    Eye,
    Pencil,
} from "lucide-react";
import "./teacherSubjects.css";
import { createNotification } from "../../Services/notificationService";

const TYPE_META = {
    Due: { Icon: Clock, color: "#2563eb", label: "Due Assignments" },
    Overdue: { Icon: AlertCircle, color: "#dc2626", label: "Overdue Assignments" },
    "Not Graded": { Icon: ClipboardList, color: "#d97706", label: "Not Graded" },
    Graded: { Icon: CheckCircle2, color: "#16a34a", label: "Graded Assignments" },
    PDF: { Icon: FileText, color: "red", label: "PDF Files" },
    PowerPoint: { Icon: Presentation, color: "Goldenrod", label: "PowerPoint Presentations" },
    Video: { Icon: Film, color: "Purple", label: "Video Recordings" },
    Image: { Icon: Image, color: "Black", label: "Images" },
    Word: { Icon: File, color: "Blue", label: "Documents" },
    Others: { Icon: FileText, color: "gray", label: "Other Files" },
};

const TABS = [
    { id: "materials", label: "Materials" },
    { id: "assignments", label: "Assignments" },
];

const ASSIGNMENT_TYPES = ["Due", "Overdue", "Not Graded", "Graded"];

function TypeTitle({ type, text }) {
    const meta = TYPE_META[type];

    if (!meta) return <>📁 {text ?? type}</>;

    const { Icon, color, label } = meta;

    return (
        <div className="Type-Title">
            <Icon color={color} className="Type-Logo" />
            {text ?? label}
        </div>
    );
}

function formatDueDate(dateStr) {
    if (!dateStr) return "No due date";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "No due date";
    return d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
}

function getGroupType(material) {
    const extension =
        material.file_name?.split(".").pop().toLowerCase() || "";

    if (extension === "pdf") return "PDF";

    if (["mp4", "mov", "avi", "mkv", "webm"].includes(extension)) {
        return "Video";
    }

    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)) {
        return "Image";
    }

    if (["doc", "docx"].includes(extension)) return "Word";

    if (["ppt", "pptx"].includes(extension)) return "PowerPoint";

    return "Others";
}

// Determine the tutor-side assignment panel.
function getAssignmentPanel(assignment, submission) {
    if (submission) {
        const status = String(submission.Status || "")
            .trim()
            .toLowerCase();

        const hasGrade =
            submission.Score !== null &&
            submission.Score !== undefined &&
            submission.Score !== "";

        if (status === "graded" || hasGrade) {
            return "Graded";
        }

        // A submitted assignment without a grade belongs here.
        if (status !== "draft") {
            return "Not Graded";
        }
    }

    if (assignment.Due_Date) {
        const deadline = new Date(assignment.Due_Date);

        if (
            !Number.isNaN(deadline.getTime()) &&
            deadline.getTime() < Date.now()
        ) {
            return "Overdue";
        }
    }

    return "Due";
}

function TeacherSubjects() {
    const { studentID } = useParams();
    const navigate = useNavigate();

    const [subjects, setSubjects] = useState([]);
    const [student, setStudent] = useState(null);
    const [allSubjects, setAllSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [activeTab, setActiveTab] = useState("materials");

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [file, setFile] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const [contentType, setContentType] = useState("Material");
    const [assignmentType, setAssignmentType] = useState("Homework");
    const [dueDate, setDueDate] = useState("");
    const [totalPoints, setTotalPoints] = useState("");

    const [showEditModal, setShowEditModal] = useState(false);
   const [editingMaterial, setEditingMaterial] = useState(null);
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editFile, setEditFile] = useState(null);
    const [editAssignmentType, setEditAssignmentType] = useState("");
    const [editDueDate, setEditDueDate] = useState("");
    const [editTotalPoints, setEditTotalPoints] = useState("");
    const [isSavingEdit, setIsSavingEdit] = useState(false);

const [materialToDelete, setMaterialToDelete] = useState(null);
const [isDeleting, setIsDeleting] = useState(false);

    const [showSubmissionsModal, setShowSubmissionsModal] = useState(false);
    const [selectedAssignmentForGrading, setSelectedAssignmentForGrading] =
        useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(false);

    const [showGradeModal, setShowGradeModal] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [score, setScore] = useState("");
    const [feedback, setFeedback] = useState("");
    const [isGrading, setIsGrading] = useState(false);
    const [submittedAssignments, setSubmittedAssignments] = useState({});

    useEffect(() => {
        LoadData();
    }, [studentID]);

    async function LoadData() {
        // Get assigned materials and their assignments.
        const { data, error } = await supabase
            .from("Material_Assignment")
            .select(`
                ID,
                Materials (
                    Material_ID,
                    Material_Name,
                    Material_URL,
                    Material_Description,
                    file_name,
                    users (Name),
                    Subjects (Subject_ID, Subject_Name),
                    Assignments (
                        Assignment_ID,
                        Assignment_Type,
                        Due_Date,
                        Total_Points
                    )
                )
            `)
            .eq("Student_ID", studentID);

        if (error) {
            console.error("Error loading materials:", error);
            return;
        }

        // Get all submissions for this student.
        const {
            data: submissionData,
            error: submissionError,
        } = await supabase
            .from("Assignment_Submissions")
            .select(`
                Submission_ID,
                Assignment_ID,
                Student_ID,
                Submission_URL,
                file_name,
                Submitted_At,
                Status,
                Score,
                Feedback,
                Graded_At,
                Is_Late
            `)
            .eq("Student_ID", studentID);

        if (submissionError) {
            console.error("Error loading submissions:", submissionError);
            return;
        }

        // Keep the latest submission for each assignment.
        const submissionMap = {};

        (submissionData || []).forEach((submission) => {
            const key = String(submission.Assignment_ID);

            if (
                !submissionMap[key] ||
                new Date(submission.Submitted_At || submission.created_at || 0) >
                    new Date(
                        submissionMap[key].Submitted_At ||
                        submissionMap[key].created_at ||
                        0
                    )
            ) {
                submissionMap[key] = submission;
            }
        });

        const submittedMap = {};

        Object.keys(submissionMap).forEach((assignmentID) => {
            submittedMap[assignmentID] = true;
        });

        setSubmittedAssignments(submittedMap);

        // Group assignments by status and other materials by file category.
        const grouped = {};

        (data || []).forEach((item) => {
            const material = item.Materials;

            if (!material) return;

            const assignments = Array.isArray(material.Assignments)
                ? material.Assignments
                : material.Assignments
                    ? [material.Assignments]
                    : [];

            if (assignments.length > 0) {
                assignments.forEach((assignment) => {
                    const submission =
                        submissionMap[String(assignment.Assignment_ID)] || null;

                    const type = getAssignmentPanel(assignment, submission);

                    if (!grouped[type]) {
                        grouped[type] = [];
                    }

                    grouped[type].push({
                        ...material,
                        assignment,
                        submission,
                        assignmentID: item.ID,
                        uniqueKey: `${item.ID}-${assignment.Assignment_ID}`,
                    });
                });

                return;
            }

            const type = getGroupType(material);

            if (!grouped[type]) {
                grouped[type] = [];
            }

            grouped[type].push({
                ...material,
                assignment: null,
                submission: null,
                assignmentID: item.ID,
                uniqueKey: `${item.ID}-${material.Material_ID}`,
            });
        });

        const categoryOrder = [
            "Due",
            "Overdue",
            "Not Graded",
            "Graded",
            "PDF",
            "Word",
            "PowerPoint",
            "Video",
            "Image",
            "Others",
        ];

        const sortedGroups = categoryOrder
            .filter((type) => grouped[type]?.length)
            .map((type) => [type, grouped[type]]);

        setSubjects(
            sortedGroups.length > 0
                ? [{ fileTypes: Object.fromEntries(sortedGroups) }]
                : []
        );

        // Get student details.
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("*")
            .eq("id", studentID)
            .single();

        if (userError) {
            console.error("Error loading student:", userError);
            return;
        }

        setStudent(userData);

        // Preserve existing subject data.
        const { data: subjectData, error: subjectError } = await supabase
            .from("Subjects")
            .select("*")
            .order("Subject_Name");

        if (subjectError) {
            console.error(subjectError);
            return;
        }

        setAllSubjects(subjectData || []);

        if (subjectData?.length > 0) {
            setSelectedSubject(subjectData[0].Subject_ID);
        }
    }

    async function uploadMaterial() {
        if (isUploading) return;

        if (!title.trim() || !description.trim() || !file || !contentType) {
            alert("Fill up all fields.");
            return;
        }

        if (
            contentType === "Assignment" &&
            (!assignmentType ||
                !dueDate ||
                !totalPoints ||
                Number(totalPoints) <= 0)
        ) {
            alert("Fill up all assignment fields.");
            return;
        }

        setIsUploading(true);

        try {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError || !user) {
                console.error(authError);
                alert("Unable to identify the logged-in tutor.");
                return;
            }

            const fileName = `${Date.now()}-${file.name}`;

            const { error: uploadError } = await supabase.storage
                .from("Material_Storage")
                .upload(fileName, file);

            if (uploadError) {
                console.error(uploadError);
                alert("Failed to upload file.");
                return;
            }

            const { data: urlData } = supabase.storage
                .from("Material_Storage")
                .getPublicUrl(fileName);

            const { data: tutor, error: tutorError } = await supabase
                .from("users")
                .select("id")
                .eq("auth_id", user.id)
                .single();

            if (tutorError) {
                console.error(tutorError);
                alert("Unable to find tutor.");
                return;
            }

            const { data: material, error: materialError } = await supabase
                .from("Materials")
                .insert({
                    Tutor_ID: tutor.id,
                    Material_Name: title,
                    Material_Description: description,
                    Material_URL: urlData.publicUrl,
                    file_name: file.name,
                })
                .select()
                .single();

            if (materialError) {
                console.error(materialError);
                alert("Failed to create material.");
                return;
            }

            const { error: assignmentError } = await supabase
                .from("Material_Assignment")
                .insert({
                    Material_ID: material.Material_ID,
                    Student_ID: studentID,
                });

            if (assignmentError) {
                console.error(assignmentError);
                alert("Failed to assign material.");
                return;
            }

            let createdAssignment = null;

            if (contentType === "Assignment") {
                const { data: assignment, error: createAssignmentError } =
                    await supabase
                        .from("Assignments")
                        .insert({
                            Material_ID: material.Material_ID,
                            Assignment_Type: assignmentType,
                            Due_Date: new Date(dueDate).toISOString(),
                            Total_Points: Number(totalPoints),
                        })
                        .select()
                        .single();

                if (createAssignmentError) {
                    console.error(createAssignmentError);
                    alert("Failed to create assignment.");
                    return;
                }

                createdAssignment = assignment;
            }

            if (contentType === "Assignment") {
                await createNotification({
                    userId: Number(studentID),
                    title: "New Assignment",
                    message: `${material.Material_Name} has been assigned to you.`,
                    type: "Assignment",
                    relatedTable: "Assignments",
                    relatedId: createdAssignment.Assignment_ID,
                    actionUrl: "/student/materials",
                });
            } else {
                await createNotification({
                    userId: Number(studentID),
                    title: "New Learning Material",
                    message: `${material.Material_Name} has been assigned to you.`,
                    type: "Material",
                    relatedTable: "Materials",
                    relatedId: material.Material_ID,
                    actionUrl: "/student/materials",
                });
            }

            alert(
                contentType === "Assignment"
                    ? "Assignment uploaded!"
                    : "Material uploaded!"
            );

            await LoadData();

            // Jump to the tab where the new upload lives.
            setActiveTab(
                contentType === "Assignment" ? "assignments" : "materials"
            );

            setTitle("");
            setDescription("");
            setFile(null);
            setContentType("Material");
            setAssignmentType("Homework");
            setDueDate("");
            setTotalPoints("");
            setShowModal(false);
        } catch (error) {
            console.error(error);
            alert("Something went wrong.");
        } finally {
            setIsUploading(false);
        }
    }

    // "https://.../Material_Storage/123-file.pdf" -> "123-file.pdf"
    function getStoragePath(url) {
        const marker = "/Material_Storage/";
        const index = String(url || "").indexOf(marker);
        if (index === -1) return null;
        return decodeURIComponent(
            url.slice(index + marker.length).split("?")[0]
        );
    }

    function openEditMaterial(material) {
        const assignment = material.assignment;

        setEditingMaterial(material);
        setEditTitle(material.Material_Name || "");
        setEditDescription(material.Material_Description || "");
        setEditFile(null);

        setEditAssignmentType(assignment?.Assignment_Type || "Homework");
        setEditTotalPoints(assignment?.Total_Points ?? "");
        setEditDueDate(
            assignment?.Due_Date
                ? new Date(
                    new Date(assignment.Due_Date).getTime() -
                    new Date(assignment.Due_Date).getTimezoneOffset() * 60000
                ).toISOString().slice(0, 16)
                : ""
        );

        setShowEditModal(true);
    }

    function closeEditModal() {
        if (isSavingEdit) return;
        setShowEditModal(false);
        setEditingMaterial(null);
        setEditFile(null);
    }

    async function saveMaterialEdit() {
        if (!editingMaterial || isSavingEdit) return;

        const assignment = editingMaterial.assignment;

        if (!editTitle.trim()) {
            alert("Title is required.");
            return;
        }

        if (
            assignment &&
            (!editAssignmentType || !editDueDate ||
                !editTotalPoints || Number(editTotalPoints) <= 0)
        ) {
            alert("Fill up all assignment fields correctly.");
            return;
        }

        setIsSavingEdit(true);

        try {
            const updates = {
                Material_Name: editTitle.trim(),
                Material_Description: editDescription.trim(),
            };

            // Optional: replace the attached file
            if (editFile) {
                const newPath = `${Date.now()}-${editFile.name}`;

                const { error: uploadError } = await supabase.storage
                    .from("Material_Storage")
                    .upload(newPath, editFile);

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage
                    .from("Material_Storage")
                    .getPublicUrl(newPath);

                updates.Material_URL = urlData.publicUrl;
                updates.file_name = editFile.name;
            }

            const { data: updatedMaterial, error: materialError } = await supabase
                .from("Materials")
                .update(updates)
                .eq("Material_ID", editingMaterial.Material_ID)
                .select();

            if (materialError) throw materialError;

            if (!updatedMaterial || updatedMaterial.length === 0) {
                throw new Error("Update was blocked. Check the RLS policy on Materials.");
            }

            if (assignment) {
                const { data: updatedAssignment, error: assignmentError } = await supabase
                    .from("Assignments")
                    .update({
                        Assignment_Type: editAssignmentType,
                        Due_Date: new Date(editDueDate).toISOString(),
                        Total_Points: Number(editTotalPoints),
                        Updated_At: new Date().toISOString(),
                    })
                    .eq("Assignment_ID", assignment.Assignment_ID)
                    .select();

                if (assignmentError) throw assignmentError;

                if (!updatedAssignment || updatedAssignment.length === 0) {
                    throw new Error("Update was blocked. Check the RLS policy on Assignments.");
                }
            }

            // Remove the old file only after everything else succeeded
            if (editFile) {
                const oldPath = getStoragePath(editingMaterial.Material_URL);
                if (oldPath) {
                    await supabase.storage.from("Material_Storage").remove([oldPath]);
                }
            }

            alert("Changes saved!");

            setShowEditModal(false);
            setEditingMaterial(null);
            setEditFile(null);

            await LoadData();
        } catch (error) {
            console.error(error);
            alert(error.message || "Failed to save changes.");
        } finally {
            setIsSavingEdit(false);
        }
    }

    async function deleteMaterial() {
        if (!materialToDelete || isDeleting) return;

        setIsDeleting(true);

        try {
            const material = materialToDelete;

            const assignmentIds = (
                Array.isArray(material.Assignments)
                    ? material.Assignments
                    : material.Assignments ? [material.Assignments] : []
            ).map((a) => a.Assignment_ID);

            // 1. This student's submissions for the assignment(s)
            if (assignmentIds.length > 0) {
                const { error } = await supabase
                    .from("Assignment_Submissions")
                    .delete()
                    .in("Assignment_ID", assignmentIds)
                    .eq("Student_ID", studentID);

                if (error) throw error;
            }

            // 2. Remove it from this student
            const { data: removed, error: removeError } = await supabase
                .from("Material_Assignment")
                .delete()
                .eq("ID", material.assignmentID)
                .select();

            if (removeError) throw removeError;

            if (!removed || removed.length === 0) {
                throw new Error("Delete was blocked. Check the RLS policy on Material_Assignment.");
            }

            // 3. If no other student still has it, delete the material itself
            const { count, error: countError } = await supabase
                .from("Material_Assignment")
                .select("ID", { count: "exact", head: true })
                .eq("Material_ID", material.Material_ID);

            if (countError) throw countError;

            if (!count) {
                if (assignmentIds.length > 0) {
                    const { error } = await supabase
                        .from("Assignments")
                        .delete()
                        .eq("Material_ID", material.Material_ID);

                    if (error) throw error;
                }

                const { error: materialError } = await supabase
                    .from("Materials")
                    .delete()
                    .eq("Material_ID", material.Material_ID);

                if (materialError) throw materialError;

                const path = getStoragePath(material.Material_URL);
                if (path) {
                    await supabase.storage.from("Material_Storage").remove([path]);
                }
            }

            alert("Deleted successfully.");
            setMaterialToDelete(null);
            await LoadData();
        } catch (error) {
            console.error(error);
            alert(error.message || "Failed to delete.");
        } finally {
            setIsDeleting(false);
        }
    }

    async function loadSubmissions(assignment) {
        setLoadingSubmissions(true);
        setSelectedAssignmentForGrading(assignment);

        const { data, error } = await supabase
            .from("Assignment_Submissions")
            .select(`
                Submission_ID,
                Assignment_ID,
                Student_ID,
                Submission_URL,
                file_name,
                Submitted_At,
                Status,
                Score,
                Feedback,
                Graded_At,
                Is_Late
            `)
            .eq("Assignment_ID", assignment.Assignment_ID)
            .eq("Student_ID", studentID)
            .order("Submitted_At", { ascending: false });

        if (error) {
            console.error("Submission error:", error);
            alert("Failed to load submissions.");
            setLoadingSubmissions(false);
            return;
        }

        setSubmissions(data || []);
        setShowSubmissionsModal(true);
        setLoadingSubmissions(false);
    }

    async function gradeSubmission() {
        if (isGrading || !selectedSubmission) return;

        if (score === "" || Number(score) < 0) {
            alert("Enter a valid score.");
            return;
        }

        const maxPoints = Number(
            selectedAssignmentForGrading?.Total_Points
        );

        if (Number(score) > maxPoints) {
            alert(`Score cannot exceed ${maxPoints} points.`);
            return;
        }

        setIsGrading(true);

        try {
            const { error } = await supabase
                .from("Assignment_Submissions")
                .update({
                    Score: Number(score),
                    Feedback: feedback,
                    Graded_At: new Date().toISOString(),
                    Status: "Graded",
                })
                .eq("Submission_ID", selectedSubmission.Submission_ID);

            if (error) {
                console.error(error);
                alert("Failed to save grade.");
                return;
            }

            await createNotification({
                userId: Number(studentID),
                title: "Assignment Graded",
                message: `Your ${selectedAssignmentForGrading.Assignment_Type} has been graded. Score: ${score}/${selectedAssignmentForGrading.Total_Points}.`,
                type: "Grade",
                relatedTable: "Assignment_Submissions",
                relatedId: selectedSubmission.Submission_ID,
                actionUrl: "/student/materials",
            });

            alert("Grade saved successfully!");

            setShowGradeModal(false);
            setSelectedSubmission(null);
            setScore("");
            setFeedback("");

            await loadSubmissions(selectedAssignmentForGrading);
            await LoadData();
        } catch (error) {
            console.error(error);
            alert("Something went wrong.");
        } finally {
            setIsGrading(false);
        }
    }

    const assignmentOptions = (
        <>
            <option value="Homework">Homework</option>
            <option value="Quiz">Quiz</option>
            <option value="Activity">Activity</option>
            <option value="Project">Project</option>
        </>
    );

    // Split the grouped data into the two tabs.
    const allGroups = subjects[0]?.fileTypes
        ? Object.entries(subjects[0].fileTypes)
        : [];

    const tabGroups = {
        materials: allGroups.filter(
            ([type]) => !ASSIGNMENT_TYPES.includes(type)
        ),
        assignments: allGroups.filter(([type]) =>
            ASSIGNMENT_TYPES.includes(type)
        ),
    };

    const countFiles = (groups) =>
        groups.reduce((total, [, files]) => total + files.length, 0);

    const counts = {
        materials: countFiles(tabGroups.materials),
        assignments: countFiles(tabGroups.assignments),
    };

    const totalMaterials = counts.materials + counts.assignments;
    const visibleGroups = tabGroups[activeTab];

    return (
        <div className="teacher-subject-container">
            <div className="breadcrumb">
                <button onClick={() => navigate(-1)}>Students</button>
                <span>›</span>
                <span>{student?.Name || "Unknown"}</span>
            </div>

            <div className="teacher-header">
                <div>
                    <h1>📚 Files of {student?.Name || "Unknown"}</h1>
                    <p>{totalMaterials} materials</p>
                </div>

                <button
                    className="btn-primary"
                    onClick={() => setShowModal(true)}
                >
                    Upload File
                </button>
            </div>

            <div className="material-tabs" role="tablist" aria-label="Files">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        id={`tab-${tab.id}`}
                        aria-selected={activeTab === tab.id}
                        aria-controls={`panel-${tab.id}`}
                        className={`material-tab ${
                            activeTab === tab.id ? "material-tab-active" : ""
                        }`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                        <span className="material-tab-count">
                            {counts[tab.id]}
                        </span>
                    </button>
                ))}
            </div>

            <div
                role="tabpanel"
                id={`panel-${activeTab}`}
                aria-labelledby={`tab-${activeTab}`}
            >
                {visibleGroups.length === 0 ? (
                    <div className="empty-state">
                        {activeTab === "materials"
                            ? "No materials yet. Upload a file to get started."
                            : "No assignments yet. Upload a file and set it as an assignment."}
                    </div>
                ) : (
                    <div className="teacher-subject-section">
                        {visibleGroups.map(([type, materials]) => (
                            <div key={type} className="material-type-section">
                                <div className="typeTitleContainer">
                                    <h3>
                                        <TypeTitle type={type} />
                                    </h3>

                                    <h3> ({materials.length})</h3>
                                </div>

                                {materials.map((material) => {
                                    const assignment = material.assignment;
                                    const submission = material.submission;

                                    return (
                                        <div
                                            key={material.uniqueKey}
                                            className="material-list-card"
                                        >
                                            <div className="card-main-content">
                                                <div className="card-title-row">
                                                    <h4>
                                                        <TypeTitle
                                                            type={type}
                                                            text={material.Material_Name}
                                                        />
                                                    </h4>
                                                </div>

                                                {assignment ? (
                                                    <>
                                                        <div className="assignment-meta-row">
                                                            <span className="assignment-type-badge">
                                                                {assignment.Assignment_Type}
                                                            </span>
                                                            <span className="assignment-meta-item">
                                                                Due: {formatDueDate(assignment.Due_Date)}
                                                            </span>
                                                            {assignment.Total_Points !== null && assignment.Total_Points !== undefined && (
                                                                <span className="assignment-meta-item">
                                                                    • {assignment.Total_Points} pts
                                                                </span>
                                                            )}
                                                        </div>

                                                        {type === "Overdue" && (
                                                            <div className="assignment-status-tag status-overdue">
                                                                <AlertCircle size={13} />
                                                                <span>Deadline passed — no submission</span>
                                                            </div>
                                                        )}

                                                        {type === "Not Graded" && (
                                                            <div className="assignment-status-tag status-pending">
                                                                <Clock size={13} />
                                                                <span>Submitted — awaiting grading</span>
                                                            </div>
                                                        )}

                                                        {type === "Graded" && (
                                                            <div className="assignment-status-tag status-graded">
                                                                <CheckCircle2 size={13} />
                                                                <span>
                                                                    Graded
                                                                    {submission?.Score !== null && submission?.Score !== undefined
                                                                        ? ` • Score: ${submission.Score}/${assignment.Total_Points}`
                                                                        : ""}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {type === "Due" && (
                                                            <div className="assignment-status-tag status-due">
                                                                <Clock size={13} />
                                                                <span>Awaiting submission</span>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="material-meta-block">
                                                    
                                                        {material.Material_Description && (
                                                            <p className="material-desc">
                                                                {material.Material_Description}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="card-actions-group">
                                                <div className="card-actions-row">
                                                    {material.Material_URL && (
                                                        <a
                                                            href={material.Material_URL}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                        >
                                                            <button type="button" className="btn-card-action btn-card-open">
                                                                Open
                                                            </button>
                                                        </a>
                                                    )}

                                                  <button
                                                        type="button"
                                                        className="btn-card-action btn-card-edit"
                                                        onClick={() => openEditMaterial(material)}
                                                    >
                                                        <Pencil size={12} />
                                                        <span>Edit</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="btn-card-action btn-card-delete"
                                                        onClick={() => setMaterialToDelete(material)}
                                                    >
                                                        <Trash2 size={12} />
                                                        <span>Delete</span>
                                                    </button>
                                                </div>

                                                {assignment &&
                                                    submittedAssignments[
                                                        assignment.Assignment_ID
                                                    ] && (
                                                        <button
                                                            type="button"
                                                            className="btn-card-action btn-card-submissions"
                                                            onClick={() =>
                                                                loadSubmissions(assignment)
                                                            }
                                                        >
                                                            <Eye size={13} />
                                                            <span>View Submission</span>
                                                        </button>
                                                    )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* UPLOAD MODAL */}
            {showModal && (
                <div className="app-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="app-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="app-modal-header">
                            <div>
                                <h2 className="app-modal-title">Upload Material</h2>
                                <p className="app-modal-desc">Share learning resources or create an assignment for this subject.</p>
                            </div>
                            <button
                                type="button"
                                className="app-modal-close"
                                onClick={() => setShowModal(false)}
                                aria-label="Close dialog"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="app-modal-body">
                            <div className="form-group">
                                <label className="form-label">
                                    Title <span className="text-danger">*</span>
                                </label>
                                <input
                                    className="form-control"
                                    placeholder="Enter material or assignment title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    className="form-control form-textarea"
                                    placeholder="Provide brief instructions or details..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    File Attachment <span className="text-danger">*</span>
                                </label>

                                {!file ? (
                                    <label className="dropzone-box">
                                        <div className="dropzone-icon">
                                            <UploadCloud size={22} />
                                        </div>
                                        <div className="dropzone-text">
                                            <span className="dropzone-accent">Click to upload a file</span> or drag & drop
                                        </div>
                                        <div className="dropzone-hint">
                                            PDF, Word, PowerPoint, Images, or Video (Max 50MB)
                                        </div>
                                        <input
                                            type="file"
                                            style={{ display: "none" }}
                                            onChange={(e) =>
                                                setFile(e.target.files?.[0] || null)
                                            }
                                        />
                                    </label>
                                ) : (
                                    <div className="selected-file-card">
                                        <div className="file-info-group">
                                            <div className="file-icon-box">
                                                <FileText size={20} />
                                            </div>
                                            <div className="file-details">
                                                <span className="file-name-text">{file.name}</span>
                                                <span className="file-meta-text">
                                                    {(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload
                                                </span>
                                            </div>
                                        </div>
                                        <div className="file-actions">
                                            <label className="btn-file-change">
                                                Change
                                                <input
                                                    type="file"
                                                    style={{ display: "none" }}
                                                    onChange={(e) =>
                                                        setFile(e.target.files?.[0] || null)
                                                    }
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                className="btn-file-remove"
                                                onClick={() => setFile(null)}
                                                title="Remove file"
                                                aria-label="Remove file"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Content Type</label>
                                <select
                                    className="form-control form-select"
                                    value={contentType}
                                    onChange={(e) => setContentType(e.target.value)}
                                >
                                    <option value="Material">Material (Resource / Handout)</option>
                                    <option value="Assignment">Assignment (Graded Task)</option>
                                </select>
                            </div>

                            {contentType === "Assignment" && (
                                <div className="assignment-config-panel">
                                    <div className="form-group">
                                        <label className="form-label">Assignment Type</label>
                                        <select
                                            className="form-control form-select"
                                            value={assignmentType}
                                            onChange={(e) =>
                                                setAssignmentType(e.target.value)
                                            }
                                        >
                                            {assignmentOptions}
                                        </select>
                                    </div>

                                    <div className="form-row-2">
                                        <div className="form-group">
                                            <label className="form-label">Due Date & Time</label>
                                            <input
                                                className="form-control"
                                                type="datetime-local"
                                                value={dueDate}
                                                onChange={(e) => setDueDate(e.target.value)}
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Total Points</label>
                                            <input
                                                className="form-control"
                                                type="number"
                                                min="1"
                                                value={totalPoints}
                                                onChange={(e) =>
                                                    setTotalPoints(e.target.value)
                                                }
                                                placeholder="e.g. 20"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="app-modal-footer">
                            <button
                                type="button"
                                className="btn-modal-cancel"
                                onClick={() => setShowModal(false)}
                            >
                                Close
                            </button>

                            <button
                                type="button"
                                className="btn-modal-submit"
                                onClick={uploadMaterial}
                                disabled={isUploading || !title.trim() || !file}
                            >
                                {isUploading ? "Uploading..." : "Upload Material"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* EDIT ASSIGNMENT MODAL */}
           {showEditModal && editingMaterial && (
            <div className="app-modal-overlay" onClick={closeEditModal}>
                <div className="app-modal-card" onClick={(e) => e.stopPropagation()}>
                    <div className="app-modal-header">
                        <div className="app-modal-header-text">
                            <h2>{editingMaterial.assignment ? "Edit Assignment" : "Edit Material"}</h2>
                            <p>Update the details, or replace the attached file</p>
                        </div>
                        <button type="button" className="app-modal-close" onClick={closeEditModal} aria-label="Close modal">
                            <X size={18} />
                        </button>
                    </div>

                    <div className="app-modal-body">
                        <div className="form-group">
                            <label className="form-label">Title <span className="text-danger">*</span></label>
                            <input
                                className="form-control"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea
                                className="form-control form-textarea"
                                value={editDescription}
                                onChange={(e) => setEditDescription(e.target.value)}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">File</label>
                            <div className="selected-file-card">
                                <div className="file-info-group">
                                    <div className="file-icon-box"><FileText size={20} /></div>
                                    <div className="file-details">
                                        <span className="file-name-text">
                                            {editFile ? editFile.name : editingMaterial.file_name || "Current file"}
                                        </span>
                                        <span className="file-meta-text">
                                            {editFile ? "New file will replace the current one" : "Current file"}
                                        </span>
                                    </div>
                                </div>
                                <div className="file-actions">
                                    <label className="btn-file-change">
                                        Replace
                                        <input
                                            type="file"
                                            style={{ display: "none" }}
                                            onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                                        />
                                    </label>
                                    {editFile && (
                                        <button
                                            type="button"
                                            className="btn-file-remove"
                                            onClick={() => setEditFile(null)}
                                            title="Keep current file"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {editingMaterial.assignment && (
                            <div className="assignment-config-panel">
                                <div className="form-group">
                                    <label className="form-label">Assignment Type</label>
                                    <select
                                        className="form-control form-select"
                                        value={editAssignmentType}
                                        onChange={(e) => setEditAssignmentType(e.target.value)}
                                    >
                                        {assignmentOptions}
                                    </select>
                                </div>

                                <div className="form-row-2">
                                    <div className="form-group">
                                        <label className="form-label">Due Date</label>
                                        <input
                                            className="form-control"
                                            type="datetime-local"
                                            value={editDueDate}
                                            onChange={(e) => setEditDueDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Total Points</label>
                                        <input
                                            className="form-control"
                                            type="number"
                                            min="1"
                                            value={editTotalPoints}
                                            onChange={(e) => setEditTotalPoints(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="app-modal-footer">
                        <button type="button" className="btn-modal-cancel" onClick={closeEditModal} disabled={isSavingEdit}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn-modal-submit"
                            onClick={saveMaterialEdit}
                            disabled={isSavingEdit || !editTitle.trim()}
                        >
                            {isSavingEdit ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* DELETE MATERIAL MODAL */}
        {materialToDelete && (
            <div className="app-modal-overlay" onClick={() => !isDeleting && setMaterialToDelete(null)}>
                <div className="app-modal-card" style={{ maxWidth: "460px" }} onClick={(e) => e.stopPropagation()}>
                    <div className="app-modal-header">
                        <div className="app-modal-header-text">
                            <h2>{materialToDelete.assignment ? "Delete Assignment" : "Delete Material"}</h2>
                            <p>This action cannot be undone</p>
                        </div>
                        <button
                            type="button"
                            className="app-modal-close"
                            onClick={() => setMaterialToDelete(null)}
                            disabled={isDeleting}
                            aria-label="Close modal"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="app-modal-body">
                        <p style={{ margin: 0, color: "#334155", fontSize: "0.92rem" }}>
                            You are about to permanently delete{" "}
                            <strong>{materialToDelete.Material_Name}</strong>
                            {student?.Name ? <> for <strong>{student.Name}</strong></> : null}.
                        </p>

                        {materialToDelete.assignment && (
                            <p style={{ margin: "10px 0 0", color: "#b91c1c", fontSize: "0.85rem" }}>
                                This also deletes the student's submission and grade for this assignment.
                            </p>
                        )}
                    </div>

                    <div className="app-modal-footer">
                        <button type="button" className="btn-modal-cancel" onClick={() => setMaterialToDelete(null)} disabled={isDeleting}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="btn-modal-submit"
                            style={{ background: "#dc2626", borderColor: "#dc2626" }}
                            onClick={deleteMaterial}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Confirm Delete"}
                        </button>
                    </div>
                </div>
            </div>
        )}
            {/* SUBMISSIONS MODAL */}
            {showSubmissionsModal && (
                <div className="app-modal-overlay" onClick={() => { setShowSubmissionsModal(false); setSelectedAssignmentForGrading(null); setSubmissions([]); }}>
                    <div className="app-modal-card" style={{ maxWidth: "600px" }} onClick={(e) => e.stopPropagation()}>
                        <div className="app-modal-header">
                            <div className="app-modal-header-text">
                                <h2>Student Submissions</h2>
                                <p>
                                    {selectedAssignmentForGrading?.Assignment_Type} • Total Points: {selectedAssignmentForGrading?.Total_Points}
                                </p>
                            </div>
                            <button
                                type="button"
                                className="app-modal-close"
                                onClick={() => {
                                    setShowSubmissionsModal(false);
                                    setSelectedAssignmentForGrading(null);
                                    setSubmissions([]);
                                }}
                                aria-label="Close modal"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="app-modal-body">
                            {loadingSubmissions ? (
                                <p style={{ color: "#64748b", margin: "16px 0", textAlign: "center" }}>Loading submissions...</p>
                            ) : submissions.length === 0 ? (
                                <p style={{ color: "#64748b", margin: "16px 0", textAlign: "center" }}>No submissions yet.</p>
                            ) : (
                                submissions.map((submission) => (
                                    <div
                                        key={submission.Submission_ID}
                                        className="submission-card"
                                    >
                                        <h4>👤 {student?.Name}</h4>

                                        <p>
                                            <strong>Status:</strong> {submission.Status || "Submitted"}
                                        </p>

                                        <p>
                                            <strong>Timing:</strong>{" "}
                                            {submission.Is_Late
                                                ? "⚠️ Late"
                                                : "✅ On Time"}
                                        </p>

                                        <p>
                                            <strong>Submitted:</strong>{" "}
                                            {submission.Submitted_At
                                                ? new Date(
                                                      submission.Submitted_At
                                                  ).toLocaleString()
                                                : "Not available"}
                                        </p>

                                        {submission.Submission_URL && (
                                            <a
                                                href={submission.Submission_URL}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                📄 Open Student Submission
                                            </a>
                                        )}

                                        <p>
                                            <strong>Score:</strong>{" "}
                                            {submission.Score !== null &&
                                            submission.Score !== undefined
                                                ? `${submission.Score} / ${selectedAssignmentForGrading.Total_Points}`
                                                : "Not graded"}
                                        </p>

                                        {submission.Feedback && (
                                            <p><strong>Feedback:</strong> {submission.Feedback}</p>
                                        )}

                                        <div style={{ marginTop: "6px" }}>
                                            <button
                                                type="button"
                                                className="btn-modal-submit"
                                                style={{ padding: "6px 14px", fontSize: "0.82rem" }}
                                                onClick={() => {
                                                    setSelectedSubmission(submission);
                                                    setScore(submission.Score ?? "");
                                                    setFeedback(submission.Feedback ?? "");
                                                    setShowGradeModal(true);
                                                }}
                                            >
                                                {submission.Score !== null &&
                                                submission.Score !== undefined
                                                    ? "✏️ Edit Grade"
                                                    : "📝 Grade"}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="app-modal-footer">
                            <button
                                type="button"
                                className="btn-modal-cancel"
                                onClick={() => {
                                    setShowSubmissionsModal(false);
                                    setSelectedAssignmentForGrading(null);
                                    setSubmissions([]);
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* GRADE MODAL */}
            {showGradeModal && (
                <div className="app-modal-overlay" onClick={() => { setShowGradeModal(false); setSelectedSubmission(null); setScore(""); setFeedback(""); }}>
                    <div className="app-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="app-modal-header">
                            <div className="app-modal-header-text">
                                <h2>Grade Submission</h2>
                                <p>Student: {student?.Name || "Student"}</p>
                            </div>
                            <button
                                type="button"
                                className="app-modal-close"
                                onClick={() => {
                                    setShowGradeModal(false);
                                    setSelectedSubmission(null);
                                    setScore("");
                                    setFeedback("");
                                }}
                                aria-label="Close modal"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="app-modal-body">
                            <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "0.85rem", display: "flex", flexDirection: "column", gap: "6px" }}>
                                <div><strong>File:</strong> {selectedSubmission?.file_name || "Attachment"}</div>
                                <div><strong>Status:</strong> {selectedSubmission?.Status} ({selectedSubmission?.Is_Late ? "⚠️ Late" : "✅ On Time"})</div>
                                <div><strong>Submitted:</strong> {selectedSubmission?.Submitted_At ? new Date(selectedSubmission.Submitted_At).toLocaleString() : "Not available"}</div>
                                {selectedSubmission?.Submission_URL && (
                                    <div style={{ marginTop: "4px" }}>
                                        <a
                                            href={selectedSubmission.Submission_URL}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{ color: "#2563eb", fontWeight: 600, textDecoration: "underline" }}
                                        >
                                            📄 Open Student Submission
                                        </a>
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Score (Max: {selectedAssignmentForGrading?.Total_Points})</label>
                                <input
                                    className="form-control"
                                    type="number"
                                    min="0"
                                    max={selectedAssignmentForGrading?.Total_Points}
                                    value={score}
                                    onChange={(e) => setScore(e.target.value)}
                                    placeholder={`Maximum: ${selectedAssignmentForGrading?.Total_Points}`}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Feedback</label>
                                <textarea
                                    className="form-control form-textarea"
                                    value={feedback}
                                    onChange={(e) => setFeedback(e.target.value)}
                                    placeholder="Enter feedback for the student..."
                                />
                            </div>
                        </div>

                        <div className="app-modal-footer">
                            <button
                                type="button"
                                className="btn-modal-cancel"
                                onClick={() => {
                                    setShowGradeModal(false);
                                    setSelectedSubmission(null);
                                    setScore("");
                                    setFeedback("");
                                }}
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                className="btn-modal-submit"
                                onClick={gradeSubmission}
                                disabled={isGrading}
                            >
                                {isGrading ? "Saving..." : "Save Grade"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TeacherSubjects;