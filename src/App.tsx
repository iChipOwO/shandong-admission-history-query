import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ProfileForm from './pages/ProfileForm';
import SearchByMajor from './pages/SearchByMajor';
import SearchBySchool from './pages/SearchBySchool';
import RecommendByRank from './pages/RecommendByRank';
import Favorites from './pages/Favorites';
import AIPrompt from './pages/AIPrompt';
import AdmissionTips from './pages/AdmissionTips';
import SchoolLibrary from './pages/SchoolLibrary';
import SchoolDetail from './pages/SchoolDetail';
import Reports from './pages/Reports';
import DataStatus from './pages/DataStatus';
import SchoolRankings from './pages/SchoolRankings';
import SubjectEvaluation from './pages/SubjectEvaluation';
import UniversityLifeTips from './pages/UniversityLifeTips';
import AboutAuthor from './pages/AboutAuthor';
import { AdmissionDataProvider } from './context/AdmissionDataContext';
import { SchoolMetadataProvider } from './context/SchoolMetadataContext';
import { MajorDirectionProvider } from './context/MajorDirectionContext';
import { RankingSubjectProvider } from './context/RankingSubjectContext';
import { useAndroidBackButton } from './hooks/useAndroidBackButton';

const AndroidBackButtonListener = () => {
  useAndroidBackButton();
  return null;
};

const App: React.FC = () => {
  return (
    <AdmissionDataProvider>
      <SchoolMetadataProvider>
        <MajorDirectionProvider>
        <RankingSubjectProvider>
        <Router>
          <AndroidBackButtonListener />
          <div className="app-container">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/profile" element={<ProfileForm />} />
              <Route path="/query" element={<SearchByMajor />} />
              <Route path="/search-major" element={<SearchByMajor />} />
              <Route path="/search-school" element={<SearchBySchool />} />
              <Route path="/recommend" element={<RecommendByRank />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/prompt" element={<AIPrompt />} />
              <Route path="/tips" element={<AdmissionTips />} />
              <Route path="/school-library" element={<SchoolLibrary />} />
              <Route path="/schools" element={<SchoolLibrary />} />
              <Route path="/schools/:schoolCode" element={<SchoolDetail />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/reports/:reportId" element={<Reports />} />
              <Route path="/data-status" element={<DataStatus />} />
              <Route path="/rankings" element={<SchoolRankings />} />
              <Route path="/subjects" element={<SubjectEvaluation />} />
              <Route path="/university-life" element={<UniversityLifeTips />} />
              <Route path="/about-author" element={<AboutAuthor />} />
            </Routes>
          </div>
        </Router>
        </RankingSubjectProvider>
        </MajorDirectionProvider>
      </SchoolMetadataProvider>
    </AdmissionDataProvider>
  );
};

export default App;
