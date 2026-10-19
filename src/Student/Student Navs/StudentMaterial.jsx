import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNavigate } from "react-router-dom";
import {
    FileText,
    Presentation,
    File,
    Film,
    Image,
    Clock,
    CheckCircle2,
    AlertCircle,
} from "lucide-react";
import "./studentMaterial.css";

const TABS = [
    { id: "materials", label: "Materials" },
    { id: "assignments", label: "Assignments" },
];

const ASSIGNMENT_ORDER = ["Due", "Overdue", "Completed"];
const MATERIAL_ORDER = ["PDF", "Word", "PowerPoint", "Video", "Image", "Others"];

function StudentMaterial() {
    const [materialGroups, setMaterialGroups] = useState([]);
    const [assignmentGroups, setAssignmentGroups] = useState([]);
    const [activeTab, setActiveTab] = useState("materials");
    const [loading, setLoading] = useState(true);

    const navigate = useNavigate();

    useEffect(() => {
        loadMaterials();
    }, []);

    async function loadMaterials() {
        setLoading(true);

        try {
            // Get authenticated user
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError || !user) {
                console.error(authError || "No authenticated user.");
                return;
            }

            // Get student account
            const { data: student, error: studentError } = await supabase
                .from("users")
                .select("id")
                .eq("auth_id", user.id)
                .single();

            if (studentError) {
                console.error(studentError);
                return;
            }

            // Get assigned materials, assignments, and submissions
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
                        Assignments (
                            Assignment_ID,
                            Assignment_Type,
                            Due_Date,
                            Total_Points,
                            Assignment_Submissions (
                                Submission_ID,
                                Student_ID,
                                Status,
                                Submitted_At,
                                Is_Late
                            )
                        )
                    )
                `)
                .eq("Student_ID", student.id);

            if (error) {
                console.error("Error loading materials:", error);
                return;
            }

            // Two separate buckets: one per tab
            const groupedAssignments = {};
            const groupedMaterials = {};

            (data || []).forEach((item) => {
                const material = item.Materials;

                if (!material) return;

                const assignments = Array.isArray(material.Assignments)
                    ? material.Assignments
                    : material.Assignments
                        ? [material.Assignments]
                        : [];

                // ---------- ASSIGNMENTS TAB ----------
                // An assigned material can have multiple assignments.
                // Process each assignment independently.
                if (assignments.length > 0) {
                    assignments.forEach((assignment) => {
                        const submissions = Array.isArray(
                            assignment.Assignment_Submissions
                        )
                            ? assignment.Assignment_Submissions
                            : [];

                        // Only use submissions belonging to this student.
                        const studentSubmissions = submissions
                            .filter(
                                (submission) =>
                                    String(submission.Student_ID) ===
                                    String(student.id)
                            )
                            .sort(
                                (a, b) =>
                                    new Date(b.Submitted_At || b.Submission_ID) -
                                    new Date(a.Submitted_At || a.Submission_ID)
                            );

                        const submission = studentSubmissions[0] || null;

                        const status = String(submission?.Status || "")
                            .trim()
                            .toLowerCase();

                        // Adjust these values if your database uses
                        // different submission status names.
                        const completedStatuses = [
                            "submitted",
                            "completed",
                            "graded",
                            "returned",
                        ];

                        let type;

                        if (completedStatuses.includes(status)) {
                            type = "Completed";
                        } else {
                            const dueDate = assignment.Due_Date
                                ? new Date(assignment.Due_Date)
                                : null;

                            if (
                                dueDate &&
                                !Number.isNaN(dueDate.getTime()) &&
                                dueDate.getTime() < Date.now()
                            ) {
                                type = "Overdue";
                            } else {
                                type = "Due";
                            }
                        }

                        if (!groupedAssignments[type]) {
                            groupedAssignments[type] = [];
                        }

                        groupedAssignments[type].push({
                            ...material,
                            assignment,
                            submission,
                            assignmentID: item.ID,
                            uniqueKey: `${item.ID}-${assignment.Assignment_ID}`,
                        });
                    });

                    return;
                }

                // ---------- MATERIALS TAB ----------
                // Non-assignment materials are grouped by file type.
                const extension =
                    material.file_name?.split(".").pop().toLowerCase() || "";

                let type = "Others";

                if (extension === "pdf") {
                    type = "PDF";
                } else if (
                    ["mp4", "mov", "avi", "mkv", "webm"].includes(extension)
                ) {
                    type = "Video";
                } else if (
                    ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(extension)
                ) {
                    type = "Image";
                } else if (["doc", "docx"].includes(extension)) {
                    type = "Word";
                } else if (["ppt", "pptx"].includes(extension)) {
                    type = "PowerPoint";
                }

                if (!groupedMaterials[type]) {
                    groupedMaterials[type] = [];
                }

                groupedMaterials[type].push({
                    ...material,
                    assignment: null,
                    assignmentID: item.ID,
                    uniqueKey: `${item.ID}-${material.Material_ID}`,
                });
            });

            const toSortedGroups = (grouped, order) =>
                order
                    .filter((type) => grouped[type]?.length)
                    .map((type) => [type, grouped[type]]);

            setAssignmentGroups(toSortedGroups(groupedAssignments, ASSIGNMENT_ORDER));
            setMaterialGroups(toSortedGroups(groupedMaterials, MATERIAL_ORDER));
        } catch (error) {
            console.error("Unexpected error loading materials:", error);
        } finally {
            setLoading(false);
        }
    }

    function renderCategoryIcon(type) {
        switch (type) {
            case "Due":
                return <Clock color="#2563eb" className="Type-Logo" />;
            case "Overdue":
                return <AlertCircle color="#dc2626" className="Type-Logo" />;
            case "Completed":
                return <CheckCircle2 color="#16a34a" className="Type-Logo" />;
            case "PDF":
                return <FileText color="red" className="Type-Logo" />;
            case "PowerPoint":
                return <Presentation color="orange" className="Type-Logo" />;
            case "Video":
                return <Film color="purple" className="Type-Logo" />;
            case "Image":
                return <Image color="black" className="Type-Logo" />;
            case "Word":
                return <File color="blue" className="Type-Logo" />;
            default:
                return <FileText className="Type-Logo" />;
        }
    }

    function renderCategoryTitle(type) {
        switch (type) {
            case "Due":
                return "Due Assignments";
            case "Overdue":
                return "Overdue Assignments";
            case "Completed":
                return "Completed Assignments";
            case "PDF":
                return "PDF Files";
            case "PowerPoint":
                return "PowerPoint Presentations";
            case "Video":
                return "Video Recordings";
            case "Image":
                return "Images";
            case "Word":
                return "Documents";
            default:
                return "Other Files";
        }
    }

    function openItem(assignment, material) {
        if (assignment) {
            navigate(`/student/materials/assignment/${assignment.Assignment_ID}`);
        } else {
            navigate(`/student/materials/material/${material.Material_ID}`);
        }
    }

    function renderCard(type, material) {
        const assignment = material.assignment;

        return (
            <div
                key={material.uniqueKey}
                className="material-list-card"
                onClick={() => openItem(assignment, material)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openItem(assignment, material);
                    }
                }}
            >
                <div>
                    <h3>
                        <div className="Type-Title">
                            {renderCategoryIcon(type)}
                            {material.Material_Name}
                        </div>
                    </h3>

                    {assignment ? (
                        <>
                            <p>
                                {assignment.Assignment_Type || "Assignment"}
                                {" • "}
                                Due:{" "}
                                {assignment.Due_Date
                                    ? new Date(assignment.Due_Date).toLocaleString()
                                    : "No due date"}
                                {" • "}
                                {assignment.Total_Points ?? 0}
                                {" points"}
                            </p>

                            {material.submission?.Status && (
                                <p>Status: {material.submission.Status}</p>
                            )}

                            {type === "Overdue" && (
                                <p className="assignment-overdue">Deadline has passed</p>
                            )}

                            {type === "Completed" && (
                                <p className="assignment-completed">
                                    Assignment submitted
                                </p>
                            )}
                        </>
                    ) : (
                        <p>
                            {material.Material_Description ||
                                "No description available."}
                        </p>
                    )}
                </div>

                <span>›</span>
            </div>
        );
    }

    function renderGroups(groups, emptyMessage) {
        if (groups.length === 0) {
            return <h3>{emptyMessage}</h3>;
        }

        return groups.map(([type, files]) => (
            <div key={type} className="material-type-section">
                <h2>
                    <div className="Type-Title">
                        {renderCategoryIcon(type)}
                        {renderCategoryTitle(type)}
                        <span className="material-count">({files.length})</span>
                    </div>
                </h2>

                {files.map((material) => renderCard(type, material))}
            </div>
        ));
    }

    if (loading) {
        return <h2>Loading materials...</h2>;
    }

    const countItems = (groups) =>
        groups.reduce((total, [, files]) => total + files.length, 0);

    const counts = {
        materials: countItems(materialGroups),
        assignments: countItems(assignmentGroups),
    };

    return (
        <div className="student-subject-container">
            <h1>📚 My Learning Materials</h1>

            <div className="material-tabs" role="tablist" aria-label="Learning materials">
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
                        <span className="material-tab-count">{counts[tab.id]}</span>
                    </button>
                ))}
            </div>

            <div
                role="tabpanel"
                id={`panel-${activeTab}`}
                aria-labelledby={`tab-${activeTab}`}
            >
                {activeTab === "materials"
                    ? renderGroups(materialGroups, "No materials assigned yet.")
                    : renderGroups(assignmentGroups, "No assignments yet.")}
            </div>
        </div>
    );
}

export default StudentMaterial;