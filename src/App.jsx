import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import Login from './Login/Login'
import TeacherDashboard from './Teacher/TeacherDashboard'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import TeacherMaterial from './Teacher/Teacher Navs/TeacherMaterial'
import TeacherSchedule from './Teacher/Teacher Navs/TeacherSchedule'
import TeacherStudent from './Teacher/Teacher Navs/TeacherStudent'
import TeacherSettings from './Teacher/Teacher Navs/TeacherSettings'
import StudentDashboard from './Student/StudentDashboard'
import StudentMaterial from './Student/Student Navs/StudentMaterial'
import StudentProgress from './Student/Student Navs/StudentProgress'
import StudentEnrollment from './Student/Student Navs/StudentEnrollment'
import StudentSchedule from './Student/Student Navs/StudentSchedule'
import StudentSettings from './Student/Student Navs/StudentSettings'
import AdminDashboard from './Admin/AdminDashboard'
import AdminSchedule from './Admin/Admin Navs/AdminSchedule'
import AdminSAT from './Admin/Admin Navs/AdminSAT'
import AdminPayment from './Admin/Admin Navs/AdminPayment'
import AdminReport from './Admin/Admin Navs/AdminReport'
import AdminSettings from './Admin/Admin Navs/AdminSettings'
import AdminMain from './Admin/Admin Navs/AdminMain'
import AdminEditProfile from './Admin/Admin Navs/AdminEditProfile'
import ProtectedRoute from './lib/ProtectedRoute'
import LandingPage from './Login/LandingPage'
import Register from './Login/Register'
import UploadMaterial from './Teacher/Teacher Navs/UploadMaterial'
import TeacherSubjects from './Teacher/Teacher Navs/TeacherSubjects'
import StudentAssignment from './Student/Student Navs/StudentAssignment'
import StudentMaterialDetails from './Student/Student Navs/StudentMaterialDetails'
import StudentProgressSubject from './Student/Student Navs/StudentProgressSubject'
import StudentHome from './Student/Student Navs/StudentHome'
import StudentMessages from './Student/Student Navs/StudentMessages'
import TeacherMessages from './Teacher/Teacher Navs/TeacherMessages'
import MainSettings from './MainComponent/MainSettings'
import TeacherMain from './Teacher/Teacher Navs/TeacherMain'
import ForgotPassword from './Login/ForgotPassword'
import ResetPassword from './Login/ResetPassword'
import TeacherStudents from './Teacher/Teacher Navs/TeacherStudents'
import StudentSubscriptionView from './Student/Student Navs/StudentSubscriptionView'



function App() {
  return (
    <>
      <BrowserRouter>
      <Routes>
        {/* Login Landing Page */}
        <Route path="/" element = {<Login/>}/>

        {/* After Login */}
        <Route path="/landing" element = {<LandingPage/>}/>
         <Route path="/register" element = {<Register/>}/>
          <Route path='forgot-password' element = {<ForgotPassword/>}/>
         <Route path="/reset-password" element={<ResetPassword/>}/>

        {/* for teacher */}
        <Route path="/teacher" element = {<ProtectedRoute allowedRole = "Tutor"><TeacherDashboard/></ProtectedRoute>}>
            
             <Route index element = {<TeacherMain/>}/>
            <Route path="material" element = {<TeacherMaterial/>}/>
            <Route path="materials/:studentID" element = {<TeacherSubjects/>}/>
            {/* <Route path="upload/:subjectId" element={<UploadMaterial />}/> */}
            <Route path="schedule" element = {<TeacherSchedule/>}/>
            <Route
                path="messages"
     
            />

                  <Route path="/teacher/students" element={<TeacherStudents/>} />
           <Route path="/teacher/students/:id" element={<TeacherStudent />} />
            <Route path="student" element = {<TeacherStudent/>}/>
            <Route path="settings" element = {<MainSettings/>}/>
        </Route>



        {/* 
        

            for student 
            
            
        */}
       
        <Route
          path="/student"
          element={
              <ProtectedRoute allowedRole="Student">
                  <StudentDashboard />
              </ProtectedRoute>
          }
       >

          <Route index element = {<StudentHome/>}/>
          <Route path="materials" element={<StudentMaterial />} />

          <Route
              path="progress"
              element={<StudentProgress />}
          />

          <Route
              path="progress/subject/:subjectID"
              element={<StudentProgressSubject />}
          />

          <Route
              path="messages"
              element={<StudentMessages/>}
          />
          <Route
            path="materials/material/:materialID"
            element={<StudentMaterialDetails />}
          />

          <Route
              path="materials/assignment/:assignmentID"
              element={<StudentAssignment />}
          />

          <Route
              path="enrollment"
              element={<StudentEnrollment />}
          />

          <Route
              path="schedule"
              element={<StudentSchedule />}
          />

          <Route
              path="subscription"
              element={<StudentSubscriptionView/>}
          />

          <Route
              path="settings"
              element={<MainSettings />}
          />
      </Route>

        <Route path="/admin" element = {
          <ProtectedRoute allowedRole = "Admin">

            <AdminDashboard/>
          </ProtectedRoute>
          
          
          }>
            <Route index element = {<AdminMain/>}/>
            <Route path="schedule" element = {<AdminSchedule/>}/>
            <Route path="student-and-tutor" element = {<AdminSAT/>}/>
            <Route path="EditProfile/:id" element = {<AdminEditProfile/>}/>
            <Route path="payment" element = {<AdminPayment/>}/>
            <Route path="report" element = {<AdminReport/>}/>
            <Route path="settings" element = {<MainSettings/>}/>
        </Route>
      </Routes>
      </BrowserRouter>
    
    </>
  )
}

export default App
