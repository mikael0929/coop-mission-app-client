import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";

const socket = io("https://coop-mission-app-server.onrender.com");

const missionDurations = {
  1: 8,
  2: 300,
  3: 300,
  4: 300,
  5: 300,
  6: 30,
  7: 5,
};

const sentenceSet = [
  "5개의 문장이 차례대로 나옵니다! 외워야 합니다 집중하세요!",
  "하느님께서 말씀하시기를 “빛이 생겨라.” 하시자 빛이 생겼다.",
  "“하늘 아래에 있는 물은 한곳으로 모여, 뭍이 드러나라.” 하시자, 그대로 되었다.",
  "씨를 맺는 풀과 씨 있는 과일나무를 제 종류대로 땅 위에 돋게 하여라.",
  "그분께서는 하시던 일을 모두 마치시고 이렛날에 쉬셨다.",
  "하느님께서 보시니 좋았다.",
];

const MissionPage = () => {
  const { missionId } = useParams();
  const missionNum = Number(missionId);
  const [status, setStatus] = useState("checking");
  const [timeLeft, setTimeLeft] = useState(missionDurations[missionNum] || 10);
  const [isCompleted, setIsCompleted] = useState(false);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const handleGlobal = ({ running, failed, completed }) => {
      if (completed.includes(missionNum)) {
        setIsCompleted(true);
        setStatus("done");
      } else if (failed.includes(missionNum)) {
        setStatus("failed");
      } else if (running.includes(missionNum)) {
        setStatus("active");
        let duration = missionDurations[missionNum] || 10;
        setTimeLeft(duration);
        timerRef.current = setInterval(() => {
          duration -= 1;
          setTimeLeft(duration);
          if (duration <= 0) {
            clearInterval(timerRef.current);
            setStatus("failed");
            socket.emit("mark-failed", missionNum);
          }
        }, 1000);
      } else {
        setStatus("ready");
        setTimeLeft(missionDurations[missionNum] || 10);
      }
    };
    socket.emit("request-global-status");
    socket.on("global-status", handleGlobal);
    return () => socket.off("global-status", handleGlobal);
  }, [missionNum]);

  const handleMissionStart = () => {
    if (status !== "ready") return;
    socket.emit("mission-start", missionNum);
    setStatus("active");
    let duration = missionDurations[missionNum] || 10;
    setTimeLeft(duration);
    timerRef.current = setInterval(() => {
      duration -= 1;
      setTimeLeft(duration);
      if (duration <= 0) {
        clearInterval(timerRef.current);
        setStatus("failed");
        socket.emit("mark-failed", missionNum);
      }
    }, 1000);
  };

  useEffect(() => {
    const onComplete = (id) => {
      if (id === missionNum) {
        clearInterval(timerRef.current);
        setIsCompleted(true);
        setStatus("done");
      }
    };
    socket.on("mission-complete", onComplete);
    return () => socket.off("mission-complete", onComplete);
  }, [missionNum]);

  useEffect(() => {
    const onReset = (resetId) => {
      if (resetId === -1 || resetId === missionNum) {
        clearInterval(timerRef.current);
        setIsCompleted(false);
        setStatus("ready");
        setTimeLeft(missionDurations[missionNum] || 10);
      }
    };
    socket.on("participant-reset", onReset);
    return () => socket.off("participant-reset", onReset);
  }, [missionNum]);

  useEffect(() => {
    if (missionNum === 6 && status === "active") {
      const interval = setInterval(() => {
        setSentenceIndex((i) => (i + 1) % sentenceSet.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [missionNum, status]);

  if (status === "checking") return <div style={{ padding: "2rem", textAlign: "center" }}>⏳ 상태 확인 중...</div>;
  if (status === "failed") return <div style={{ padding: "2rem", textAlign: "center" }}><h1>❌ 미션 {missionId} 실패</h1><p>선생님께 가세요</p></div>;
  if (status === "done") return <div style={{ padding: "2rem", textAlign: "center" }}><h1>✅ 미션 {missionId} 완료</h1><p>성공! 선생님께 확인 받으세요</p></div>;
  if (status === "active") return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>🧩 미션 {missionId}</h1>
      {missionNum === 6 ? (
        <>
          <p style={{ fontSize: "1.5rem" }}>{sentenceSet[sentenceIndex]}</p>
          <p>⏳ 남은 시간: {timeLeft}초</p>
        </>
      ) : (
        <>
          <img src={`/images/mission${missionId}.png`} alt="mission" style={{ maxWidth: 300 }} />
          <p>⏳ 남은 시간: {timeLeft}초</p>
        </>
      )}
    </div>
  );

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>🎯 미션 {missionId}</h1>
      <p>🕒 제한시간: {missionDurations[missionNum] || 10}초</p>
      <button onClick={handleMissionStart} style={{ fontSize: "1.5rem", padding: "1rem" }}>
        미션 확인
      </button>
    </div>
  );
};

export default MissionPage;
