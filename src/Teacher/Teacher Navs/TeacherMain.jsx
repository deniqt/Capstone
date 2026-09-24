import "./teacherMain.css";
import {
  UserRoundPlus,
  CalendarCheck,
  FolderOpen,
  FileText,
  MoreVertical,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

function TeacherMain() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    students: 0,
    sessions: 0,
    records: 0,
  });

  const [upcomingSchedule, setUpcomingSchedule] = useState([]);
  const [recentMaterials, setRecentMaterials] = useState([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);

      /*
       * =========================================================
       * 1. GET LOGGED-IN AUTH USER
       * =========================================================
       */

      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authUser) {
        throw new Error("No authenticated user found.");
      }

      /*
       * =========================================================
       * 2. GET CURRENT TUTOR
       * =========================================================
       */

      const { data: tutor, error: tutorError } = await supabase
        .from("users")
        .select("id, Name, Role, Status")
        .eq("auth_id", authUser.id)
        .single();

      if (tutorError) throw tutorError;

      if (!tutor) {
        throw new Error("Tutor record not found.");
      }

      if (tutor.Role !== "Tutor") {
        throw new Error("Logged-in user is not a Tutor.");
      }

      /*
       * =========================================================
       * 3. GET STUDENTS ASSIGNED TO THIS TUTOR
       * =========================================================
       *
       * user_details.Tutor_ID -> tutor.id
       * user_details.detail_id -> users.detail_id
       */

      const { data: assignedDetails, error: detailsError } =
        await supabase
          .from("user_details")
          .select("detail_id, Tutor_ID, Grade_Level")
          .eq("Tutor_ID", tutor.id);

      if (detailsError) throw detailsError;

      const detailIds = (assignedDetails || [])
        .map((detail) => detail.detail_id)
        .filter(Boolean);

      let assignedStudents = [];

      if (detailIds.length > 0) {
        const { data: students, error: studentsError } =
          await supabase
            .from("users")
            .select("id, Name, Role, Status, detail_id")
            .in("detail_id", detailIds)
            .eq("Role", "Student");

        if (studentsError) throw studentsError;

        assignedStudents = students || [];
      }

      /*
       * =========================================================
       * 4. STUDENT STATISTICS
       * =========================================================
       */

      setStats((prev) => ({
        ...prev,
        students: assignedStudents.length,
        records: assignedStudents.length,
      }));

      /*
       * =========================================================
       * 5. GET TUTOR'S ACTIVE CALENDAR SCHEDULES
       * =========================================================
       *
       * IMPORTANT:
       *
       * Actual calendar schema:
       *
       * tutor_id
       * student_id
       * start_datetime
       * end_datetime
       *
       * NOT:
       * start
       * end
       *
       * This matches TeacherSchedule.jsx.
       */

      const {
        data: schedules,
        error: scheduleError,
      } = await supabase
        .from("calendar")
        .select(
          `
            id,
            title,
            student_id,
            tutor_id,
            start_datetime,
            end_datetime,
            status,
            meeting_platform,
            meeting_link,
            notes,
            created_by
          `
        )
        .eq("tutor_id", tutor.id)
        .in("status", ["Pending", "Confirmed"])
        .order("start_datetime", { ascending: true });

      if (scheduleError) {
        console.error(
          "Calendar query error:",
          scheduleError
        );

        throw scheduleError;
      }

      /*
       * =========================================================
       * 6. KEEP ONLY UPCOMING SESSIONS
       * =========================================================
       */

      const now = new Date();

      const futureSchedules = (schedules || []).filter(
        (schedule) => {
          if (!schedule.start_datetime) return false;

          const endDate = schedule.end_datetime
            ? new Date(schedule.end_datetime)
            : new Date(schedule.start_datetime);

          return endDate >= now;
        }
      );

      /*
       * =========================================================
       * 7. GET STUDENTS USED BY SCHEDULES
       * =========================================================
       */

      const scheduleStudentIds = [
        ...new Set(
          futureSchedules
            .map((schedule) => schedule.student_id)
            .filter(Boolean)
        ),
      ];

      let scheduleStudentMap = {};

      if (scheduleStudentIds.length > 0) {
        const {
          data: scheduleStudents,
          error: scheduleStudentsError,
        } = await supabase
          .from("users")
          .select("id, Name, detail_id")
          .in("id", scheduleStudentIds);

        if (scheduleStudentsError) {
          throw scheduleStudentsError;
        }

        /*
        * Get Grade Level + Profile Image
        */

        const scheduleDetailIds = [
        ...new Set(
            (scheduleStudents || [])
            .map((student) => student.detail_id)
            .filter(Boolean)
        ),
        ];

        let scheduleDetailMap = {};

        if (scheduleDetailIds.length > 0) {
        const {
            data: scheduleDetails,
            error: scheduleDetailsError,
        } = await supabase
            .from("user_details")
            .select(
            "detail_id, Grade_Level, profile_url"
            )
            .in(
            "detail_id",
            scheduleDetailIds
            );

        if (scheduleDetailsError) {
            throw scheduleDetailsError;
        }

        (scheduleDetails || []).forEach(
            (detail) => {
            scheduleDetailMap[
                detail.detail_id
            ] = detail;
            }
        );
        }

        /*
        * Build student map
        */

        (scheduleStudents || []).forEach(
        (student) => {

            const detail =
            scheduleDetailMap[
                student.detail_id
            ];

            scheduleStudentMap[
            student.id
            ] = {

            ...student,

            Grade_Level:
                detail?.Grade_Level ||
                "Grade N/A",

            profile_url:
                detail?.profile_url ||
                null,

            };

        }
        );
    }
      /*
       * =========================================================
       * 8. FORMAT UPCOMING SCHEDULE
       * =========================================================
       */

      const formattedSchedules =
        futureSchedules
          .slice(0, 5)
          .map((schedule) => {
            const student =
              scheduleStudentMap[
                schedule.student_id
              ];

            const startDate = new Date(
              schedule.start_datetime
            );

            const endDate = schedule.end_datetime
              ? new Date(schedule.end_datetime)
              : startDate;

            const durationMinutes = Math.max(
              0,
              Math.round(
                (endDate.getTime() -
                  startDate.getTime()) /
                  60000
              )
            );

            const time =
              startDate.toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              });

            const initials = student?.Name
            ? student.Name
                .trim()
                .split(/\s+/)
                .map((name) =>
                    name.charAt(0)
                )
                .slice(0, 2)
                .join("")
                .toUpperCase()
            : "ST";

            return {
              id: schedule.id,

              time,

              duration:
                durationMinutes > 0
                  ? `${durationMinutes} mins`
                  : "Session",

              student:
                student?.Name ||
                "Unknown Student",

              grade:
                student?.Grade_Level ||
                "Grade N/A",

              /*
               * TeacherSchedule stores the schedule
               * title rather than a guaranteed `subject`
               * column.
               *
               * If title is the subject/session title,
               * use it here.
               */
              subject:
                schedule.title ||
                "Tutorial Session",

              mode:
                schedule.meeting_platform ||
                "Face to Face",

              avatar: initials,

                profileUrl:
                student?.profile_url || null,

              status: schedule.status,
            };
          });

      setUpcomingSchedule(
        formattedSchedules
      );

      /*
       * =========================================================
       * 9. SESSION STATISTIC
       * =========================================================
       */

      setStats((prev) => ({
        ...prev,
        sessions:
          futureSchedules.length,
      }));

      /*
       * =========================================================
       * 10. GET RECENT MATERIALS
       * =========================================================
       */

      const {
        data: materials,
        error: materialsError,
      } = await supabase
        .from("Materials")
        .select(
          `
            Material_ID,
            Material_Name,
            Material_URL,
            Tutor_ID,
            file_name,
            created_at
          `
        )
        .eq("Tutor_ID", tutor.id)
        .order("created_at", {
          ascending: false,
        })
        .limit(5);

      if (materialsError) {
        throw materialsError;
      }

      const materialList = materials || [];

      /*
       * =========================================================
       * 11. GET MATERIAL ASSIGNMENTS
       * =========================================================
       */

      const materialIds = materialList
        .map(
          (material) =>
            material.Material_ID
        )
        .filter(Boolean);

      let materialAssignments = [];

      if (materialIds.length > 0) {
        const {
        data: assignments,
        error: assignmentsError,
        } = await supabase
        .from("Material_Assignment")
        .select("Material_ID, Student_ID")
        .in("Material_ID", materialIds);

        if (assignmentsError) {
        console.error(
            "Material assignment query error:",
            assignmentsError
        );

        throw assignmentsError;
        }

        materialAssignments =
          assignments || [];
      }

      /*
       * =========================================================
       * 12. GET STUDENT NAMES FOR MATERIALS
       * =========================================================
       */

      const materialStudentIds = [
        ...new Set(
          materialAssignments
            .map(
              (assignment) =>
                assignment.Student_ID
            )
            .filter(Boolean)
        ),
      ];

      let materialStudentMap = {};

      if (
        materialStudentIds.length > 0
      ) {
        const {
          data: materialStudents,
          error: materialStudentsError,
        } = await supabase
          .from("users")
          .select("id, Name")
          .in(
            "id",
            materialStudentIds
          );

        if (materialStudentsError) {
          throw materialStudentsError;
        }

        (
          materialStudents || []
        ).forEach((student) => {
          materialStudentMap[
            student.id
          ] = student;
        });
      }

      /*
       * =========================================================
       * 13. FORMAT MATERIALS
       * =========================================================
       */

      const formattedMaterials =
        materialList.map((material) => {
          const assignments =
            materialAssignments.filter(
              (assignment) =>
                assignment.Material_ID ===
                material.Material_ID
            );

          const studentNames =
            assignments
              .map(
                (assignment) =>
                  materialStudentMap[
                    assignment.Student_ID
                  ]?.Name
              )
              .filter(Boolean);

          let sharedText =
            "Not assigned";

          if (
            studentNames.length === 1
          ) {
            sharedText = `Shared with ${studentNames[0]}`;
          } else if (
            studentNames.length > 1
          ) {
            sharedText = `Shared with ${studentNames.length} students`;
          }

          return {
            id: material.Material_ID,

            name:
              material.file_name ||
              material.Material_Name ||
              "Untitled Material",

            shared: sharedText,

            size: "File",
          };
        });

      setRecentMaterials(
        formattedMaterials
      );
    } catch (error) {
      console.error(
        "Error loading teacher dashboard:",
        error
      );

      setUpcomingSchedule([]);
      setRecentMaterials([]);

      setStats({
        students: 0,
        sessions: 0,
        records: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="teacher-dashboard-content">

      {/* Page Title */}
      <div className="teacher-heading">
        <h1>Dashboard</h1>

        <p>
          Welcome to YOSEF’s Tutorial Center
          Management System
        </p>
      </div>

      {/* Statistics */}
      <div className="teacher-stat-grid">

        <div className="teacher-stat-card">

          <div className="teacher-stat-icon blue">
            <UserRoundPlus size={23} />
          </div>

          <div className="teacher-stat-info">
            <strong>
              {loading
                ? "..."
                : stats.students}
            </strong>

            <span>Total Enrollees</span>
          </div>

        </div>

        <div className="teacher-stat-card">

          <div className="teacher-stat-icon green">
            <CalendarCheck size={23} />
          </div>

          <div className="teacher-stat-info">
            <strong>
              {loading
                ? "..."
                : stats.sessions}
            </strong>

            <span>Schedule Sessions</span>
          </div>

        </div>

        <div className="teacher-stat-card">

          <div className="teacher-stat-icon red">
            <FolderOpen size={23} />
          </div>

          <div className="teacher-stat-info">
            <strong>
              {loading
                ? "..."
                : stats.records}
            </strong>

            <span>Student Records</span>
          </div>

        </div>

      </div>

      {/* Dashboard Sections */}
      <div className="teacher-dashboard-grid">

        {/* Upcoming Schedule */}
        <section className="schedule-card">

          <div className="dashboard-card-header">

            <h2>Upcoming Schedule</h2>

            <button
              className="view-calendar-button"
              onClick={() =>
                navigate(
                  "/teacher/schedule"
                )
              }
            >
              View Calendar
            </button>

          </div>

          <div className="schedule-list">

            {loading ? (
              <div className="empty-dashboard">
                Loading schedule...
              </div>
            ) : upcomingSchedule.length ===
              0 ? (
              <div className="empty-dashboard">
                No upcoming sessions.
              </div>
            ) : (
              upcomingSchedule.map(
                (schedule) => (
                  <div
                    className="schedule-row"
                    key={schedule.id}
                  >

                    <div className="schedule-time">

                      <strong>
                        {schedule.time}
                      </strong>

                      <span>
                        {schedule.duration}
                      </span>

                    </div>

                    <div className="schedule-student">

                      <div className="student-avatar">

                        {schedule.profileUrl ? (
                            <img
                            src={schedule.profileUrl}
                            alt={schedule.student}
                            className="student-profile-image"
                            />
                        ) : (
                            schedule.avatar
                        )}

                        </div>
                      <div className="student-details">

                        <strong>
                          {schedule.student}
                        </strong>

                        <span>
                          {schedule.grade}
                        </span>

                      </div>

                    </div>

                    <div className="schedule-mode">

                      <span className="mode-dot"></span>

                      {schedule.mode}

                    </div>

                    <button
                      className="details-button"
                      onClick={() =>
                        navigate(
                          "/teacher/schedule"
                        )
                      }
                    >
                      Details
                    </button>

                  </div>
                )
              )
            )}

          </div>

        </section>

        {/* Recent Materials */}
        <section className="materials-card">

          <div className="dashboard-card-header">

            <h2>Recent Materials</h2>

            <button
              className="upload-button"
              onClick={() =>
                navigate(
                  "/teacher/subjects"
                )
              }
            >
              Upload
            </button>

          </div>

          <div className="materials-list">

            {loading ? (
              <div className="empty-dashboard">
                Loading materials...
              </div>
            ) : recentMaterials.length ===
              0 ? (
              <div className="empty-dashboard">
                No recent materials.
              </div>
            ) : (
              recentMaterials.map(
                (material) => (
                  <div
                    className="material-row"
                    key={material.id}
                  >

                    <div className="material-file-icon">
                      <FileText size={17} />
                    </div>

                    <div className="material-info">

                      <strong>
                        {material.name}
                      </strong>

                      <span>
                        {material.shared} •{" "}
                        {material.size}
                      </span>

                    </div>

                    <button
                      className="material-menu"
                      type="button"
                    >
                      <MoreVertical
                        size={17}
                      />
                    </button>

                  </div>
                )
              )
            )}

          </div>

        </section>

      </div>

    </div>
  );
}

export default TeacherMain;