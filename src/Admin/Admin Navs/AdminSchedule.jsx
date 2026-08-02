import FullCalendar from "@fullcalendar/react";

import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import "./adminSchedule.css"
import interactionPlugin from "@fullcalendar/interaction";
import { supabase } from "../../lib/supabase";
import { useEffect, useState } from "react";

function AdminSchedule(){
    const [events,setEvents]=useState([]);
    const [showModal, setShowModal] = useState(false);
    const [availableStudents, setAvailableStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [selectedDate, setSelectedDate] = useState(null);
    const [assignedTutor, setAssignedTutor] = useState(null);
    const [duration,setDuration] = useState(1);
    const [notes,setNotes]=useState("");

    useEffect(()=>{

    getEvents();

    },[]);

     let endDate = null;

    if(selectedDate){

        endDate = new Date(selectedDate);

        endDate.setHours(
            endDate.getHours()+duration
        );

    }
    async function loadTutor(tutorId){

        const { data } = await supabase
            .from("users")
            .select("*")
            .eq("id", tutorId)
            .single();

        setAssignedTutor(data);
    }

    async function loadAvailableStudents(startDate, hours = duration){

        const { data: students, error } = await supabase
        .from("users")
        .select(`
            *,
            details:user_details!users_detail_id_fkey(*)
        `)
        .eq("Role","Student")
        .eq("Status","Active");


        const endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + hours);

        const { data: schedules, error: scheduleError } = await supabase
            .from("calendar")
            .select("*")
            .lt("start_datetime", endDate.toISOString())
            .gt("end_datetime", startDate.toISOString());

        if (scheduleError) {
            console.error(scheduleError);
            return;
        }

        const busyStudents = (schedules || []).map(
            schedule => schedule.student_id
        );

        const busyTutors = (schedules || []).map(
            schedule => schedule.tutor_id
        );


        const available = students.filter(student =>
            !busyStudents.includes(student.id)
            &&
            !busyTutors.includes(student.details.Tutor_ID)
        );

        setAvailableStudents(available);
    }

   async function handleEventDrop(info) {
        const confirmMove = window.confirm(
            "Move this schedule to the new time?"
        );

        if (!confirmMove) {
            info.revert();
            return;
        }

        const { error } = await supabase
            .from("calendar")
            .update({
                start_datetime: info.event.start,
                end_datetime: info.event.end,
            })
            .eq("id", info.event.id);

        if (error) {
            console.error(error);
            info.revert();
        }
    }


    async function handleEventResize(info) {
            const { error } = await supabase
                .from("calendar")
                .update({
                    start_datetime: info.event.start,
                    end_datetime: info.event.end,
                })
                .eq("id", info.event.id);

            if (error) {
                console.error(error);

                // Undo resize if database update failed
                info.revert();
            }
        }
    async function getEvents(){

            const {data,error}=await supabase

            .from("calendar")

            .select("*");

            if(error){

            console.log(error);

            return;

            }

            const formatted=data.map(event=>({

            id:event.id,

            title:event.title,

            start:event.start_datetime,

            end:event.end_datetime,

            color:event.color

            }));

            setEvents(formatted);

            }

            async function createSchedule(){

                const start = new Date(selectedDate);

                const end = new Date(start);
                end.setHours(end.getHours() + duration);

                console.log("selectedDate", selectedDate);
                console.log("start", start);
                console.log("ISO", start.toISOString());

                const { error } = await supabase
                    .from("calendar")
                    .insert({
                        title: selectedStudent.Name,
                        student_id: selectedStudent.id,
                        tutor_id: selectedStudent.details.Tutor_ID,
                        start_datetime: start.toISOString(),
                        end_datetime: end.toISOString(),
                        notes:notes,
                        color: "#4CAF50"
                    });

                if(error){

                    console.log(error);

                    return;

                }

                alert("Schedule created.");

                setShowModal(false);
                setSelectedStudent(null);
                setAssignedTutor(null);
                setDuration(1);
                setNotes("");
                setSelectedDate("");

                 await getEvents();

            }

    return(<>
        <h1> ADMIN Schedule</h1>

        <div >
            <FullCalendar

            plugins={[

            dayGridPlugin,

            timeGridPlugin,

            interactionPlugin,

            listPlugin

            ]}

            initialView="timeGridWeek"
            
            headerToolbar={{

            left:"prev,next today",

            center:"title",

            right:"dayGridMonth,timeGridWeek,timeGridDay,listWeek"

            }}
            nowIndicator={true}
            events={events}
            editable={true}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}

          dateClick={async (info) => {
                console.log("Clicked!", info.date);

                  const date = new Date(info.date);

                // Format for datetime-local
                setSelectedDate(info.date);            
                await loadAvailableStudents(date);

      
                setSelectedStudent(null);
                setAssignedTutor(null);
                setNotes("");
                setDuration(1);
                setShowModal(true);
            }}
            />

            
        </div>


        {showModal && (

        <div className="modal-overlay">
              <div className="modal">
                    <select
                            value={selectedStudent?.id || ""}
                        onChange={async (e)=>{
                                const student = availableStudents.find(
                                    s => s.id == e.target.value
                                );

                                if (!student) {
                                    setSelectedStudent(null);
                                    setAssignedTutor(null);
                                    return;
                                }

                                setSelectedStudent(student);
                                await loadTutor(student.details.Tutor_ID);

                            }}
                        >
                            <option value="">
                                Select Student
                            </option>
                            {
                                availableStudents.map(student=>
                                <option
                                    key={student.id}
                                    value={student.id}
                                >
                                    {student.Name}
                                </option>
                            )
                            }
                        </select>
                        
                     {selectedStudent && (
                        <div>
                            <p>
                                Assigned Tutor:
                                <strong>{assignedTutor?.Name || "Loading..."}</strong>
                            </p>
                        </div>
                    )}
                        {selectedDate && (
                            <>
                            <label>Start Time</label>

                            <input
                                type="datetime-local"
                                value={
                                    selectedDate
                                        ? new Date(
                                            selectedDate.getTime() -
                                            selectedDate.getTimezoneOffset() * 60000
                                        )
                                            .toISOString()
                                            .slice(0,16)
                                        : ""
                                }
                               onChange={async (e) => {

                                const newDate = new Date(e.target.value);

                                setSelectedDate(newDate);

                                await loadAvailableStudents(newDate);

                                setSelectedStudent(null);
                                setAssignedTutor(null);
                            }}
                            />
                            </>
                        )}

                        <select
                            value={duration}
                            onChange={async (e) => {
                                const hours = Number(e.target.value);

                                setDuration(hours);

                                if (selectedDate) {
                                    await loadAvailableStudents(selectedDate, hours);
                                }

                                setSelectedStudent(null);
                                setAssignedTutor(null);
                            }}
                        >

                        <option value={1}>1 Hour</option>

                        <option value={2}>2 Hours</option>

                        <option value={3}>3 Hours</option>

                        </select>

                    {endDate && (
                            <>
                            <label>End Time</label>

                            <input
                                    type="datetime-local"
                                    value={
                                        endDate
                                            ? new Date(
                                                endDate.getTime() -
                                                endDate.getTimezoneOffset() * 60000
                                            )
                                                .toISOString()
                                                .slice(0,16)
                                            : ""
                                    }
                                    readOnly
                                />
                            </>
                        )}

                        <textarea

                        placeholder="Notes"

                        value={notes}

                        onChange={(e)=>setNotes(e.target.value)}

                        />

                        <button
                            onClick={createSchedule}
                            disabled={!selectedStudent}
                        >
                            Schedule Session
                        </button>


                        <button
                        onClick={() => {
                            setShowModal(false);
                            setSelectedStudent(null);
                            setAssignedTutor(null);
                            setNotes("");
                            setDuration(1);
                        }}
                    >
                        Cancel
                    </button>
                    </div>
            </div>
                

        )}
    </>);

  
}

export default AdminSchedule