import { useNavigate } from "react-router-dom";
import { useState } from "react"; // removed useEffect, useParams
import { Mic } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Layout from "../components/layout/Layout";

const CourseStudy = ({ user }) => {
  const { t } = useTranslation();
  const [doubt, setDoubt] = useState("");
  const [answer, setAnswer] = useState("");  
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Hardcoded lecture data
  const lectures = [
    {
      _id: "1",
      title: "Introduction to Deep Learning",
      description: "An overview of what deep learning is and how it differs from traditional ML.",
      video: "https://www.youtube.com/embed/aircAruvnKk", // YouTube embed URL
    },
    {
      _id: "2",
      title: "Neural Networks Basics",
      description: "Understanding perceptrons and feedforward neural networks.",
      video: "https://www.youtube.com/embed/ILsA4nyG7I0",
    },
    {
      _id: "3",
      title: "Backpropagation Explained",
      description: "How training in neural networks actually works.",
      video: "https://www.youtube.com/embed/GlcnxUlrtek",
    }
  ]; // ← added hardcoded lecture array

  const [selectedLecture, setSelectedLecture] = useState(lectures[0]); // ← initialized from hardcoded lectures

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 3000));
      setLoading(false);

      if (doubt === "डीप लर्निंग मशीन लर्निंग की अन्य तकनीकों से कैसे भिन्न है?") {
        setAnswer("डीप लर्निंग मशीन लर्निंग का एक उपसमूह है जो न्यूरल नेटवर्क का उपयोग करके मानव मस्तिष्क की सीखने की प्रक्रिया की नकल करता है...");
      } else if (doubt.includes("deep learning")) {
        setAnswer("Deep learning is a subset of machine learning that uses neural networks...");
      } else if (doubt.includes("neural")) {
        setAnswer("Neural networks are machine learning models inspired by the human brain...");
      } else {
        setAnswer("Sorry! I don't know the answer.");
      }
    } catch (error) {
      console.error("Error occurred while submitting doubt:", error);
    }
  };

  return (
    <Layout>
      <div className="flex h-screen">
        {/* Left side - Video section */}
        <div className="flex-1 bg-gray-100 p-4">
          <h1 className="text-2xl font-bold mb-4">Course Lectures</h1>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">{selectedLecture.title}</h2>
            <p className="text-gray-600 mb-2">{selectedLecture.description}</p>
          </div>
          <div className="w-full h-96 bg-black">
            <iframe
              src={selectedLecture.video}
              title={selectedLecture.title}
              className="w-full h-full object-cover"
              allowFullScreen
            ></iframe> {/* ← replaced video tag with iframe for YouTube */}
          </div>
        </div>

        {/* Right side - Lecture list */}
        <div className="w-1/3 bg-white border-l border-gray-200 overflow-y-auto">
          <h2 className="text-xl font-semibold p-4 border-b border-gray-200">
            Other Lectures
          </h2>
          <ul>
            {lectures.map((lecture) => (
              <li
                key={lecture._id}
                onClick={() => setSelectedLecture(lecture)}
                className={`cursor-pointer p-4 border-b border-gray-200 hover:bg-gray-100 ${
                  selectedLecture._id === lecture._id ? "bg-gray-200" : ""
                }`}
              >
                <h3 className="text-lg font-semibold">{lecture.title}</h3>
                <p className="text-gray-600 text-sm">{lecture.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className='mt-8'>
        <h2 className='text-2xl mb-2'>{t('anyDoubts')}</h2>
        <div className='mb-4 flex items-center w-[700px]'>
          <input
            type="text"
            placeholder="Ask your doubt ..."
            className="flex-1 px-3 py-2 border rounded-lg bg-gray-200 focus:border-blue-500 focus:outline-none"
            value={doubt}
            onChange={(e) => setDoubt(e.target.value)}
          />
          <label className='ml-2 text-purple-500 cursor-pointer'><Mic /></label>
        </div>
        <button className='p-2 bg-purple-400 px-4 mt-2 text-white' onClick={handleSubmit}>{t('submit')}</button>
        {loading && <svg xmlns="http://www.w3.org/2000/svg" width="2em" height="2em" viewBox="0 0 24 24"><circle cx="18" cy="12" r="0" fill="currentColor"><animate attributeName="r" begin=".67" calcMode="spline" dur="1.5s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle><circle cx="12" cy="12" r="0" fill="currentColor"><animate attributeName="r" begin=".33" calcMode="spline" dur="1.5s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle><circle cx="6" cy="12" r="0" fill="currentColor"><animate attributeName="r" begin="0" calcMode="spline" dur="1.5s" keySplines="0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8;0.2 0.2 0.4 0.8" repeatCount="indefinite" values="0;2;0;0"/></circle></svg>}

        <p className="font-bold mt-4">{t('answer')}</p>
        {answer && 
          <p className='pb-6'>{answer}</p>
        }
      </div>
    </Layout>
  );
};

export default CourseStudy;
