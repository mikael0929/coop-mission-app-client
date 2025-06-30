import React, { useEffect, useRef, useState } from "react";
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
  const [status, setStatus] = useState("loading");
  const [timeLeft, setTimeLeft] = useState(null);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const handleStatus = ({ running, failed, completed, durations }) => {
      if (completed.includes(missionNum)) {
        setStatus("done");
      } else if (failed.includes(missionNum)) {
        setStatus("failed");
      } else if (running.includes(missionNum)) {
        setStatus("active");
        const t = durations[missionNum] ?? missionDurations[missionNum];
        setTimeLeft(t);
        if (!timerRef.current) {
          timerRef.current = setInterval(() => {
            setTimeLeft((prev) => {
              if (prev <= 1) {
                clearInterval(timerRef.current);
                timerRef.current = null;
                socket.emit("mark-failed", missionNum);
                setStatus("failed");
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      } else {
        setStatus("ready");
        setTimeLeft(durations[missionNum] ?? missionDurations[missionNum]);
      }
    };

    socket.emit("request-global-status");
    socket.on("global-status", handleStatus);
    return () => socket.off("global-status", handleStatus);
  }, [missionNum]);

  const handleStart = () => {
    if (status !== "ready") return;
    socket.emit("mission-start", missionNum);
  };

  useEffect(() => {
    const onComplete = (id) => {
      if (id === missionNum) {
        clearInterval(timerRef.current);
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
        timerRef.current = null;
        setStatus("ready");
        setTimeLeft(missionDurations[missionNum]);
      }
    };
    socket.on("participant-reset", onReset);
    return () => socket.off("participant-reset", onReset);
  }, [missionNum]);

  useEffect(() => {
    if (missionNum === 6 && status === "active") {
      const interval = setInterval(() => {
        setSentenceIndex((prev) => (prev + 1) % sentenceSet.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [missionNum, status]);

  if (status === "loading") return <div style={{ textAlign: "center", padding: "2rem" }}>⏳ 상태 확인 중...</div>;
  if (status === "failed") return <div style={{ textAlign: "center", padding: "2rem" }}><h1>❌ 미션 {missionId} 실패</h1><p>선생님께 가세요</p></div>;
  if (status === "done") return <div style={{ textAlign: "center", padding: "2rem" }}><h1>✅ 미션 {missionId} 완료</h1><p>성공! 선생님께 확인 받으세요</p></div>;
  if (status === "active") return (
    <div style={{ textAlign: "center", padding: "2rem" }}>
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
    <div style={{ textAlign: "center", padding: "2rem" }}>
      <h1>🎯 미션 {missionId}</h1>
      <p>🕒 제한시간: {missionDurations[missionNum] || 10}초</p>
      <button onClick={handleStart} style={{ fontSize: "1.5rem", padding: "1rem" }}>
        미션 확인
      </button>
    </div>
  );
};

export default MissionPage;
