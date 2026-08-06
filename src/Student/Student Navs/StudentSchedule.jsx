import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";

import { supabase } from "../../lib/supabase";
import { useEffect, useState } from "react";

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

    useEffect(() => {
            getStudent();
    }, []);

    useEffect(() => {
        if (loggedStudent) {
            getEvents(loggedStudent.id);
            loadTodaySessions(loggedStudent.id);
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
                            loadUpcomingSessions()
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

                color:
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

    return(<>
        <h1> STUDENT ATTENDANCE & SCHEDULE</h1>

        <div className="student-lower-panel">
            <div className="student-lower-left">
                <div className="lower-left-panel">
                    <h3>Overall Attendance</h3>
                    <h1>Comming Soon</h1>   
                </div>

                <div className="lower-left-panel">
                    <h3>classes Attendance</h3>
                    <h1>Comming Soon</h1>   
                </div>

                <div className="lower-left-panel">
                    <h3>Missed classes</h3>
                    <h1>Comming Soon</h1>   
                                    
                </div>

                <div className="rate-previous-session-panel">
                    <h3>Rate Previous Session</h3>    
                    <h1>Comming Soon</h1>         
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
    </>);
}

export default StudentSchedule