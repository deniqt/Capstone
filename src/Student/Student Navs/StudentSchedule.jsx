import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";

import { supabase } from "../../lib/supabase";
import { useEffect, useState } from "react";


import { createNotification } from "../../Services/notificationService";

import "./studentSchedule.css";

function StudentSchedule(){
    const [events, setEvents] = useState([]);
    const [loggedStudent, setLoggedStudent] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [todaySessions, setTodaySessions] = useState([]);
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [newScheduleDate, setNewScheduleDate] = useState(null);
    const [rescheduleDuration, setRescheduleDuration] = useState(1);
    const [rescheduleReason, setRescheduleReason] = useState("");
    const [classAttendedCount, setClassAttendedCount] = useState();
    const [classAbsentCount, setClassAbsentCount] = useState();
    const [attendancePercentage, setAttendancePercentage] = useState();

    const [ratingSession, setRatingSession] = useState(null);
    const [rating, setRating] = useState(0);
    const [ratingComment, setRatingComment] = useState("");
    const [submittingRating, setSubmittingRating] = useState(false);
    const [ratedSessions, setRatedSessions] = useState([]);

    useEffect(() => {
            getStudent();
    }, []);

    useEffect(() => {
        if (loggedStudent) {
            getEvents(loggedStudent.id);
            loadTodaySessions(loggedStudent.id);
            getAttendace();
             getRatedSessions(loggedStudent.id);
        }
    }, [loggedStudent]);

    useEffect(() => {

            if (!loggedStudent) return;

            const channel = supabase
                .channel("student-calendar")

                .on(
                    "postgres_changes",
                    {
                        event: "*",
                        schema: "public",
                        table: "calendar",
                        filter: `student_id=eq.${loggedStudent.id}`
                    },
                    async () => {

                        await Promise.all([
                            getEvents(loggedStudent.id),
                            getAttendace()
                        ]);

                        if (selectedEvent) {

                            const { data } = await supabase
                                .from("calendar")
                                .select("*")
                                .eq("id", selectedEvent.id)
                                .single();

                            if (data) {

                                setSelectedEvent({
                                    id: data.id,
                                    title: data.title,
                                    start: new Date(data.start_datetime),
                                    end: new Date(data.end_datetime),
                                    ...data
                                });

                            } else {

                                setSelectedEvent(null);

                            }

                        }

                    }
                )

                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };

        }, [loggedStudent, selectedEvent]);

    async function getStudent() {

        const {
            data: { user }
        } = await supabase.auth.getUser();

        const { data, error } = await supabase
            .from("users")
            .select("*")
            .eq("auth_id", user.id)
            .single();

        if(error){
            console.log(error);
            return;
        }

        setLoggedStudent(data);

    }

    async function getEvents(studentId){

        const { data, error } = await supabase
            .from("calendar")
            .select("*")
            .eq("student_id", studentId);

        if(error){
            console.log(error);
            return;
        }

        const formatted = data.map(event => ({

                id:event.id,
                title:event.title,

                start:event.start_datetime,
                end:event.end_datetime,

                student_id:event.student_id,
                tutor_id:event.tutor_id,

                notes:event.notes,

                meeting_platform:event.meeting_platform,
                meeting_link:event.meeting_link,

                status:event.status,

                requested_start_datetime:event.requested_start_datetime,
                requested_end_datetime:event.requested_end_datetime,

                reschedule_reason:event.reschedule_reason,
                student_approval:event.student_approval,
                tutor_approval: event.tutor_approval,  
                admin_approval:event.admin_approval,
                reschedule_requested_by:event.reschedule_requested_by,

                backgroundColor:
                    event.status === "Pending"
                    ? "#ffc10741"
                    : event.status === "Confirmed"
                    ? "#4caf4f48"
                    : event.status === "Reschedule Pending"
                    ? "#9b27b03f"
                    : event.status === "Cancelled"
                    ? "#f4433638"
                    : event.status === "Attended"
                    ? "#2195f32d"
                    : event.status === "Absent"
                    ? "#61616131"
                    : "#607d8b34",

                    borderColor:
                    event.status === "Pending"
                    ? "#FFC107"
                    : event.status === "Confirmed"
                    ? "#4CAF50"
                    : event.status === "Reschedule Pending"
                    ? "#9C27B0"
                    : event.status === "Cancelled"
                    ? "#F44336"
                    : event.status === "Attended"
                    ? "#2196F3"
                    : event.status === "Absent"
                    ? "#616161"
                    : "#607D8B"

            }));

            setEvents(formatted);

    }





    async function loadTodaySessions(studentId){

        const today = new Date();

        const start = new Date(today);
        start.setHours(0,0,0,0);

        const end = new Date(today);
        end.setHours(23,59,59,999);

        const { data } = await supabase

        .from("calendar")

        .select("*")

        .eq("student_id", studentId)

        .gte("start_datetime", start.toISOString())

        .lte("start_datetime", end.toISOString())

        .order("start_datetime");

        setTodaySessions(data || []);

    }




    async function approveReschedule(){

        const { error } = await supabase
            .from("calendar")
            .update({

                student_approval:"Approved"

            })
            .eq("id", selectedEvent.id);

        if(error){

            console.log(error);

            return;

        }


        // ==========================================
        // TUTOR NOTIFICATION
        // ==========================================

        await createNotification({

            userId: selectedEvent.tutor_id,

            title: "Reschedule Approved by Student",

            message:
                `The student ${selectedEvent.title} has approved the reschedule request. Please review the request.`,

            type: "schedule",

            relatedTable: "calendar",

            relatedId: selectedEvent.id,

            actionUrl: "/teacher/schedule"

        });


        // ==========================================
        // ADMIN NOTIFICATION
        // ==========================================

        const { data: admins, error: adminError } = await supabase
            .from("users")
            .select("id")
            .eq("Role", "Admin")
            .eq("Status", "Active");

        if (adminError) {

            console.log("Failed to get admins:", adminError);

        } else {

            for (const admin of admins || []) {

                await createNotification({

                    userId: admin.id,

                    title: "Reschedule Approved by Student",

                    message:
                        `${selectedEvent.title} has approved the reschedule request. The request is ready for review.`,

                    type: "schedule",

                    relatedTable: "calendar",

                    relatedId: selectedEvent.id,

                    actionUrl: "/admin/schedule"

                });

            }

        }


        await getEvents(loggedStudent.id);

        await loadTodaySessions(loggedStudent.id);

        setSelectedEvent(null);

    }




    async function rejectReschedule(){

        const { error } = await supabase
            .from("calendar")
            .update({

                student_approval:"Rejected",

                requested_start_datetime:null,
                requested_end_datetime:null,
                reschedule_reason:null,

                status:"Confirmed"

            })
            .eq("id", selectedEvent.id);

        if(error){

            console.log(error);

            return;

        }


        // ==========================================
        // TUTOR NOTIFICATION
        // ==========================================

        await createNotification({

            userId: selectedEvent.tutor_id,

            title: "Reschedule Rejected by Student",

            message:
                `The student ${selectedEvent.title} has rejected the reschedule request. The original schedule remains unchanged.`,

            type: "schedule",

            relatedTable: "calendar",

            relatedId: selectedEvent.id,

            actionUrl: "/teacher/schedule"

        });


        // ==========================================
        // ADMIN NOTIFICATION
        // ==========================================

        const { data: admins, error: adminError } = await supabase
            .from("users")
            .select("id")
            .eq("Role", "Admin")
            .eq("Status", "Active");

        if (adminError) {

            console.log("Failed to get admins:", adminError);

        } else {

            for (const admin of admins || []) {

                await createNotification({

                    userId: admin.id,

                    title: "Reschedule Rejected by Student",

                    message:
                        `${selectedEvent.title} has rejected the reschedule request. The original schedule remains unchanged.`,

                    type: "schedule",

                    relatedTable: "calendar",

                    relatedId: selectedEvent.id,

                    actionUrl: "/admin/schedule"

                });

            }

        }


        await getEvents(loggedStudent.id);

        await loadTodaySessions(loggedStudent.id);

        setSelectedEvent(null);

    }




   async function requestReschedule(){

        if(!newScheduleDate){
            alert("Please select a new schedule.");
            return;
        }

        if(rescheduleReason.trim() === ""){
            alert("Please provide a reason.");
            return;
        }

        const now = new Date();

        if(newScheduleDate <= now){

            alert("Please choose a future schedule.");

            return;

        }

        const currentStart = new Date(selectedEvent.start);

        const diffHours =
            (currentStart - now) / (1000 * 60 * 60);

        if(diffHours < 12){

            alert(
                "Reschedule requests must be made at least 12 hours before the session."
            );

            return;

        }

        const end = new Date(newScheduleDate);

        end.setHours(
            end.getHours() + rescheduleDuration
        );

        const conflict = await hasConflict(

            selectedEvent.id,
            loggedStudent.id,
            selectedEvent.tutor_id,
            newScheduleDate,
            end

        );

        if(conflict){

            alert(
                "The selected schedule conflicts with an existing student or tutor session."
            );

            return;

        }

        const { data: existing } = await supabase
            .from("calendar")
            .select("requested_start_datetime,status")
            .eq("id", selectedEvent.id)
            .single();

        if (
            existing.status === "Reschedule Pending" ||
            existing.requested_start_datetime
        ){
            alert("A reschedule request is already pending.");
            return;
        }

        const { error } = await supabase
            .from("calendar")
            .update({

                requested_start_datetime:
                    newScheduleDate.toISOString(),

                requested_end_datetime:
                    end.toISOString(),

                reschedule_reason:
                    rescheduleReason,

                reschedule_requested_by:
                    "Student",

                student_approval:
                    "Approved",
                
                tutor_approval:
                    "Pending",

                admin_approval:
                    "Pending",

                status:
                    "Reschedule Pending"

            })
            .eq("id", selectedEvent.id);

        if(error){

            console.log(error);

            return;

        }


        // ==========================================
        // TUTOR NOTIFICATION
        // ==========================================

        await createNotification({

            userId: selectedEvent.tutor_id,

            title: "Reschedule Request",

            message:
                `The student ${selectedEvent.title} has requested to reschedule the class to ${newScheduleDate.toLocaleString()}.`,

            type: "schedule",

            relatedTable: "calendar",

            relatedId: selectedEvent.id,

            actionUrl: "/teacher/schedule"

        });


        // ==========================================
        // ADMIN NOTIFICATION
        // ==========================================

        const { data: admins, error: adminError } = await supabase
            .from("users")
            .select("id")
            .eq("Role", "Admin")
            .eq("Status", "Active");

        if (adminError) {

            console.log("Failed to get admins:", adminError);

        } else {

            for (const admin of admins || []) {

                await createNotification({

                    userId: admin.id,

                    title: "Student Reschedule Request",

                    message:
                        `${selectedEvent.title} has requested to reschedule a class to ${newScheduleDate.toLocaleString()}.`,

                    type: "schedule",

                    relatedTable: "calendar",

                    relatedId: selectedEvent.id,

                    actionUrl: "/admin/schedule"

                });

            }

        }

        await getEvents(loggedStudent.id);
        await loadTodaySessions(loggedStudent.id);

        setShowRescheduleModal(false);
        setSelectedEvent(null);

        setNewScheduleDate(null);
        setRescheduleDuration(1);
        setRescheduleReason("");

        alert(
            "Reschedule request sent to the administrator."
        );

    }




    async function hasConflict(
            eventId,
            studentId,
            tutorId,
            start,
            end
        ){

            const { data, error } = await supabase
                .from("calendar")
                .select("*")
                .neq("id", eventId)
                .in("status", [
                    "Pending",
                    "Confirmed",
                    "Reschedule Pending"
                ])
                .lt("start_datetime", end.toISOString())
                .gt("end_datetime", start.toISOString());

            if(error){
                console.log(error);
                return true;
            }

            const studentConflict = data.some(
                schedule => schedule.student_id === studentId
            );

            const tutorConflict = data.some(
                schedule => schedule.tutor_id === tutorId
            );

            return studentConflict || tutorConflict;
        }




        async function getAttendace() {


            const{data, error} = await supabase
            .from("calendar")
            .select("*")
            .eq("student_id", loggedStudent.id)
            ;


            if(error){
                console.log(error);
                return;
            }
            const attendedCount = data.filter(
                sched => sched.status === "Attended"
            ).length;

             const absentCount = data.filter(
                sched => sched.status === "Absent"
            ).length;


           const totalCount = attendedCount + absentCount;

            const attendancePercentage =
                totalCount > 0
                    ? Number(((attendedCount / totalCount) * 100).toFixed(2))
                    : 0;


            console.log(attendedCount);
            setClassAttendedCount(attendedCount);
            setClassAbsentCount(absentCount);
            setAttendancePercentage(attendancePercentage);
            
        }



        async function getRatedSessions(studentId) {

            const { data, error } = await supabase
                .from("Session_Ratings")
                .select("Calendar_ID")
                .eq("Student_ID", studentId);

            if (error) {
                console.log(error);
                return;
            }

            setRatedSessions(
                data.map(rating => rating.Calendar_ID)
            );
        }
        


        function getPreviousRateableSession() {

            const now = new Date();

            const previousSessions = events
                .filter(event => {

                    const end = new Date(event.end);

                    return (
                        end < now &&
                        event.status !== "Cancelled" &&
                        event.status !== "Pending" &&
                        !ratedSessions.includes(event.id)
                    );

                })
                .sort(
                    (a, b) =>
                        new Date(b.end) -
                        new Date(a.end)
                );

            return previousSessions[0] || null;
        }




        async function submitRating() {

            if (!ratingSession) {
                return;
            }

            if (rating < 1 || rating > 5) {
                alert("Please select a rating from 1 to 5 stars.");
                return;
            }

            setSubmittingRating(true);

            try {

                const { error } = await supabase
                    .from("Session_Ratings")
                    .insert({
                        Calendar_ID: ratingSession.id,
                        Student_ID: loggedStudent.id,
                        Tutor_ID: ratingSession.tutor_id,
                        Rating: rating,
                        Comment: ratingComment.trim() || null,
                        created_at: new Date().toISOString()
                    });

                if (error) {

                    console.log("Rating submission error:", error);

                    alert("Failed to submit rating.");

                    return;
                }

                setRatedSessions(prev => [
                    ...prev,
                    ratingSession.id
                ]);

                setRatingSession(null);
                setRating(0);
                setRatingComment("");

                alert("Thank you for rating your session! ⭐");

            } finally {

                setSubmittingRating(false);

            }
        }

    return(<div className="Main-Sched">
        <h1> STUDENT ATTENDANCE & SCHEDULE</h1>

        <div className="student-lower-panel">
            <div className="student-lower-left">
                <div className="lower-left-panel">
                    <h3>Overall Attendance</h3>
                    <h1>{attendancePercentage} %</h1>   
                </div>

                <div className="lower-left-panel">
                    <h3>Classes Attendance</h3>
                    <h1>{classAttendedCount}</h1>   
                </div>

                <div className="lower-left-panel">
                    <h3>Missed classes</h3>
                    <h1>{classAbsentCount}</h1>   
                                    
                </div>

                <div className="rate-previous-session-panel">

                    <h3>
                        Rate Previous Session
                    </h3>

                    {(() => {

                        const previousSession =
                            getPreviousRateableSession();

                        if (!previousSession) {

                            return (
                                <>

                                    <h1>✓</h1>

                                    <p>
                                        No session waiting for a rating.
                                    </p>

                                </>
                            );

                        }

                        return (
                            <>

                                <h4>
                                    {previousSession.title}
                                </h4>

                                <p>
                                    {new Date(
                                        previousSession.start
                                    ).toLocaleDateString()}
                                </p>

                                <button
                                    onClick={() =>
                                        setRatingSession(
                                            previousSession
                                        )
                                    }
                                >
                                    ⭐ Rate Session
                                </button>

                            </>
                        );

                    })()}

                </div>


            </div>

             <div className="student-lower-right">
                <div className="calendar-panel"> 
                    <h3>Calendar</h3>

                    <FullCalendar

                        plugins={[
                            dayGridPlugin,
                            timeGridPlugin,
                            interactionPlugin,
                            listPlugin
                        ]}

                        initialView="timeGridWeek"

                        headerToolbar={{
                            left:"dayGridMonth,timeGridWeek,timeGridDay,listWeek",
                            right:"today prev,next"
                        }}

                        events={events}

                        nowIndicator={true}

                        editable={false}

                        eventClick={(info)=>{

                            setSelectedEvent({

                                id:info.event.id,

                                title:info.event.title,

                                start:info.event.start,

                                end:info.event.end,

                                ...info.event.extendedProps

                            });

                        }}

                         eventContent={(eventInfo) => {
                            const status = eventInfo.event.extendedProps.status;
                                return (
                                    <div className="custom-event-content" style={{ display: 'flex', flexDirection: 'column' }}>
                                        <div className="fc-event-title" style={{ fontSize: '0.75em',fontWeight: 'bold', color:'#2563eb'}}>
                                            {eventInfo.event.title}
                                        </div>
                                        <div className="fc-event-time" style={{ fontSize: '0.65em' , color:'#2563eb'}}>
                                            {eventInfo.timeText}
                                        </div>
                                         <div
                                            className={`fc-event-status ${
                                                status ? status.toLowerCase().replace(/\s+/g, "-") : ""
                                            }`}

                                            style={{ fontSize: '0.65em'}}
                                        >
                                            {status || "No Status"}
                                        </div>
                                    </div>
                                );
                            }} 

                        /* ADD THIS HOOK HERE */
                        eventDidMount={(info) => {
                            // 1. Remove standard borders
                            info.el.style.border = 'none';
                            
                            // 2. Set only the left border using the event's mapped borderColor
                            if (info.event.borderColor) {
                            info.el.style.borderLeft = `4px solid ${info.event.borderColor}`;
                            }
                        }}

                        height="90%"
                    />
                </div>

                <div className="today-session-panel"> 
                    <h3>Today's Sessions</h3>
                    {todaySessions.map(session=>(

                        <div
                            className="Session-card"
                            key={session.id}
                        >

                            <h4>{session.title}</h4>

                            <p>
                                {new Date(session.start_datetime)
                                .toLocaleTimeString()}
                            </p>

                            <p>{session.status}</p>

                        </div>

                        ))}
                </div>
            </div>
        </div>


     {/* 
        /////////////
        modal for Selected Event
        /////////////
    */}

    {selectedEvent && (

            <div className="modal-overlay">
                <div className="modal">

                    <h2>{selectedEvent.title}</h2>

                    <p>
                        <strong>Status:</strong>{" "}
                        {selectedEvent.status}
                    </p>

                    <p>
                        <strong>Start:</strong>{" "}
                        {selectedEvent.start.toLocaleString()}
                    </p>

                    <p>
                        <strong>End:</strong>{" "}
                        {selectedEvent.end.toLocaleString()}
                    </p>

                    <p>
                        <strong>Platform:</strong>{" "}
                        {selectedEvent.meeting_platform || "N/A"}
                    </p>

                    <p>
                        <strong>Notes:</strong>
                        <br />
                        {selectedEvent.notes || "No notes"}
                    </p>

                    {selectedEvent.status === "Reschedule Pending" && (

                        <div className="reschedule-status">

                            <h3>Reschedule Request</h3>

                            <p>
                                <strong>Requested By:</strong>{" "}
                                {selectedEvent.reschedule_requested_by}
                            </p>

                            <p>
                                <strong>Requested Start:</strong>
                                <br />

                                {new Date(
                                    selectedEvent.requested_start_datetime
                                ).toLocaleString()}
                            </p>

                            <p>
                                <strong>Requested End:</strong>
                                <br />

                                {new Date(
                                    selectedEvent.requested_end_datetime
                                ).toLocaleString()}
                            </p>

                            <p>
                                <strong>Reason:</strong>
                                <br />

                                {selectedEvent.reschedule_reason}
                            </p>

                            <p>
                                Student Approval:
                                {" "}
                                {selectedEvent.student_approval}
                            </p>

                            <p>
                                Admin Approval:
                                {" "}
                                {selectedEvent.admin_approval}
                            </p>

                        </div>

                    )}


                    {selectedEvent.status === "Reschedule Pending" &&
                        selectedEvent.student_approval === "Pending" && (

                            <>

                                <button
                                    onClick={approveReschedule}
                                >
                                    Approve
                                </button>

                                <button
                                    onClick={rejectReschedule}
                                >
                                    Reject
                                </button>

                            </>

                        )}

                    {selectedEvent.status === "Confirmed" &&
                    !selectedEvent.requested_start_datetime &&
                    new Date(selectedEvent.start) > new Date() &&  (

                    <button
                        onClick={() => {

                            setNewScheduleDate(selectedEvent.start);

                            const hours =
                                (selectedEvent.end - selectedEvent.start) /
                                (1000 * 60 * 60);

                            setRescheduleDuration(hours);

                            setRescheduleReason("");

                            setShowRescheduleModal(true);

                        }}
                    >
                        Request Reschedule
                    </button>

                    )}

                    {selectedEvent.meeting_link && (
                        <>
                            <p>
                                {selectedEvent.meeting_link}
                            </p>

                            <button
                                onClick={() =>
                                    navigator.clipboard.writeText(
                                        selectedEvent.meeting_link
                                    )
                                }
                            >
                                Copy Link
                            </button>
                        </>
                    )}

                    {selectedEvent.status === "Confirmed" &&
                    !selectedEvent.requested_start_datetime &&
                    selectedEvent.meeting_link && (

                    <a
                        href={selectedEvent.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                    >
                        Join Meeting
                    </a>

                    )}

                    <button
                        onClick={() => setSelectedEvent(null)}
                    >
                        Close
                    </button>

                </div>
            </div>

        )}

    {/* 
        /////////////
        modal for Reschedule
        /////////////
    */}

    {showRescheduleModal && (

            <div className="modal-overlay">
                <div className="modal">

                    <h2>Request Reschedule</h2>

                    <label>New Schedule</label>

                    <input
                        type="datetime-local"
                        value={
                            newScheduleDate
                            ?
                            new Date(
                                newScheduleDate.getTime()
                                -
                                newScheduleDate.getTimezoneOffset()*60000
                            )
                            .toISOString()
                            .slice(0,16)
                            :
                            ""
                        }
                        onChange={(e)=>
                            setNewScheduleDate(
                                new Date(e.target.value)
                            )
                        }
                    />

                    <select
                        value={rescheduleDuration}
                        onChange={(e)=>
                            setRescheduleDuration(
                                Number(e.target.value)
                            )
                        }
                    >
                        <option value={1}>1 Hour</option>
                        <option value={2}>2 Hours</option>
                        <option value={3}>3 Hours</option>
                    </select>

                    {newScheduleDate && (

                        <>
                            <label>Requested End Time</label>

                            <input
                                type="datetime-local"
                                readOnly
                                value={
                                    (()=>{

                                        const end = new Date(
                                            newScheduleDate
                                        );

                                        end.setHours(
                                            end.getHours() +
                                            rescheduleDuration
                                        );

                                        return new Date(
                                            end.getTime()
                                            -
                                            end.getTimezoneOffset()*60000
                                        )
                                        .toISOString()
                                        .slice(0,16);

                                    })()
                                }
                            />
                        </>

                    )}

                    <textarea
                        placeholder="Reason for rescheduling..."
                        value={rescheduleReason}
                        onChange={(e)=>
                            setRescheduleReason(
                                e.target.value
                            )
                        }
                    />

                    <button
                        onClick={requestReschedule}
                    >
                        Submit Request
                    </button>

                    <button
                        onClick={()=>{

                            setShowRescheduleModal(false);

                            setNewScheduleDate(null);

                            setRescheduleDuration(1);

                            setRescheduleReason("");

                        }}
                    >
                        Cancel
                    </button>

                </div>
            </div>

        )}

        {/* 
            /////////////
            modal for rate 
            /////////////
        */}

        {ratingSession && (

            <div className="modal-overlay">

                <div className="modal rating-modal">

                    <h2>
                        Rate Your Session
                    </h2>

                    <p>
                        {ratingSession.title}
                    </p>

                    <p>
                        How was your tutoring session?
                    </p>


                    <div className="star-rating">

                        {[1, 2, 3, 4, 5].map(star => (

                            <button
                                key={star}
                                type="button"
                                className={
                                    star <= rating
                                        ? "star active"
                                        : "star"
                                }
                                onClick={() =>
                                    setRating(star)
                                }
                            >
                                ★
                            </button>

                        ))}

                    </div>


                    <p className="rating-label">

                        {rating === 1 && "Very Poor"}
                        {rating === 2 && "Poor"}
                        {rating === 3 && "Average"}
                        {rating === 4 && "Good"}
                        {rating === 5 && "Excellent"}

                    </p>


                    <textarea
                        placeholder="Optional feedback..."
                        value={ratingComment}
                        onChange={(e) =>
                            setRatingComment(
                                e.target.value
                            )
                        }
                    />


                    <div className="rating-actions">

                        <button
                            onClick={submitRating}
                            disabled={
                                rating === 0 ||
                                submittingRating
                            }
                        >
                            {submittingRating
                                ? "Submitting..."
                                : "Submit Rating"}
                        </button>


                        <button
                            onClick={() => {

                                setRatingSession(null);
                                setRating(0);
                                setRatingComment("");

                            }}
                        >
                            Cancel
                        </button>

                    </div>

                </div>

            </div>

        )}
    </div>);
}

export default StudentSchedule