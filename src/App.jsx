// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Components
import ScrollToTop from "./components/ScrollToTop";

// Pages
import LandingPage from "./pages/LandingPage";
import Demo from "./pages/Demo";
import AuthPage from "./pages/AuthPage";
import AdminDashboard from "./pages/AdminDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import StudentCheck from "./components/check/StudentCheck";
import AdminCheck from "./components/check/AdminCheck";
import CourseCreationPage from "./pages/CourseCreationPage";
import EnrollmentPage from "./pages/EnrollmentPage";
import AssignmentPage from "./pages/AssignmentPage";
import AttendancePage from "./pages/AttendancePage";
import StudentAttendancePage from "./pages/StudentAttendancePage";
import QuizGeneratorPage from "./pages/QuizGeneratorPage";
import QuizPage from "./pages/QuizPage";
import QuizResultsPage from "./pages/QuizResultsPage";
import CoursePage from "./pages/CoursePage";
import Quizzes from "./pages/Quizzes";
import CourseEditPage from "./pages/CourseEditPage";
import StudentAssignmentsPage from "./pages/StudentAssignmentsPage";
import StudentSettingsPage from "./pages/StudentSettingsPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import StudentDiscussionPage from "./pages/StudentDiscussionPage";
import AdminDiscussionPage from "./pages/AdminDiscussionPage";
import CalendarPage from "./pages/CalendarPage";
import AdminCalendarPage from "./pages/AdminCalendarPage";
import TaskManagerPage from "./pages/TaskManagerPage";
import AdminNoteManager from "./pages/AdminNoteManager";
import StudentNotes from "./pages/StudentNotes";
import AdminCourseLinks from "./pages/AdminCourseLinks";
import AdminWorkLinks from "./pages/AdminWorkLinks";
import AdminRoadmap from "./pages/AdminRoadmap";
import StudentRoadmap from "./pages/StudentRoadmap";
// Sonner
import { Toaster } from "sonner";
import StudentCourseLinks from "./pages/StudentCourseLinks";
import CodePlayground from "./pages/CodePlayground";

function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="relative flex flex-col min-h-screen bg-[#0b0f17] text-white overflow-hidden">
        {/* Main Content */}
        <main className="flex-1 relative z-10 ">
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/demo" element={<Demo />} />

            {/* Auth routes */}
            <Route path="/login" element={<AuthPage />} />

            //admin routes
            <Route path="/admin/*" element={
              
              <AdminCheck>
              <AdminDashboard />
              </AdminCheck>} />

              <Route path="/admin/create-course" element={
                
                <AdminCheck>
                <CourseCreationPage />
                </AdminCheck>} />

                 <Route path="/admin/assignments" element={
                  <AdminCheck>
                  <AssignmentPage />
                  </AdminCheck>} 
                 />
             
             <Route path="/admin/attendance" element={
              <AdminCheck>
              <AttendancePage />
              </AdminCheck>} />
             
              <Route path="/admin/generate-quiz" element={
                <AdminCheck>
                <QuizGeneratorPage />
                </AdminCheck>} />
              <Route path="/admin/quiz-results" element={
                <AdminCheck>
                <QuizResultsPage />
                </AdminCheck>} />
               <Route path="/courses/edit/:id" element={
                <AdminCheck>
                <CourseEditPage />
                </AdminCheck>} />
              <Route path="/admin/notes" element={
                <AdminCheck>
                <AdminNoteManager/>
                </AdminCheck>} />

                <Route path="/admin/roadmaps" element={
                  <AdminCheck>
                  <AdminRoadmap/>
                  </AdminCheck>} />
              
              <Route
          path="/admin/settings"
          element={
            <AdminCheck>
           
              <AdminSettingsPage />
              </AdminCheck>
            
          }
        />
         <Route
          path="/admin/discussions"
          element={
              <AdminCheck>
              <AdminDiscussionPage />
              </AdminCheck>
          }
        />

        <Route path="/admin/calendar" element={
          <AdminCheck>
          <AdminCalendarPage/>
          </AdminCheck>} />
         <Route path="/admin/course-links" element={
          <AdminCheck>
          <AdminCourseLinks/>
          </AdminCheck>} />
                  <Route path="/admin/work-links" element={
                    <AdminCheck>
                    <AdminWorkLinks/>
                    </AdminCheck>} />
         <Route
          path="/student/settings"
          element={
            <StudentCheck>
           
              <StudentSettingsPage />
              </StudentCheck>
            
          }
        />

        <Route
          path="/student/assignments"
          element={
              <StudentCheck>
              <StudentAssignmentsPage />
              </StudentCheck>
            
          }
        />

             //student routes
            <Route path="/student/*" element={
              <StudentCheck>
              <StudentDashboard />
              </StudentCheck>} />
            <Route path="/student/enrollments" element={
              <StudentCheck>
              <EnrollmentPage />
              </StudentCheck>} />
            <Route path="/courses/:id" element={
              <StudentCheck>
              <CoursePage />
              </StudentCheck>} />

            <Route path="/student/attendance" element={
              <StudentCheck>
              <StudentAttendancePage />
              </StudentCheck>} />

               <Route path="/student/quiz" element={<StudentCheck> <QuizPage /></StudentCheck>} />
                <Route path="/student/quiz/:id" element={<StudentCheck> <Quizzes /></StudentCheck>} />
                <Route path="/student/assignments" element={<StudentCheck> <StudentAssignmentsPage /></StudentCheck>} />
                <Route path="/student/calendar" element={<StudentCheck><CalendarPage/></StudentCheck>  } />
                <Route path="/student/tasks" element={ <StudentCheck> <TaskManagerPage/></StudentCheck>} />

                  <Route path="/student/code-editor" element={<CodePlayground/>} />
                 <Route
          path="/student/discussions"
          element={
            <StudentCheck>
              <StudentDiscussionPage />
              </StudentCheck>
              
           
          }
        />
          <Route path="/student/roadmaps" element={
            <StudentCheck>
            <StudentRoadmap/>
            </StudentCheck>} />
        <Route path="/student/notes" element={
          <StudentCheck>
          <StudentNotes/>
          </StudentCheck>} />
        <Route path="/student/course-links" element={
          <StudentCheck>
          <StudentCourseLinks/>
          </StudentCheck>} />
          </Routes>
        </main>

        {/* Sonner Toaster */}
        <Toaster position="top-right" richColors />
      </div>
    </Router>
  );
}

export default App;
