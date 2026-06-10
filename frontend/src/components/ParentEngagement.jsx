import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../hooks/useAuth';
import WellbeingChart from './WellbeingChart';

export const ParentEngagement = ({ childId, childName, schoolName }) => {
  const { userData } = useAuth();
  const [engagement, setEngagement] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEngagement = async () => {
      if (!childId) return;

      try {
        setLoading(true);

        // Get all activity logs for the user (filter by date in memory to avoid index requirement)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // activityLogs has no schoolName field — filter by userId (childId) only
        // Optimized: order by timestamp desc and limit to 100 to prevent thousands of reads
        const activityQuery = query(
          collection(db, 'activityLogs'),
          where('userId', '==', childId),
          orderBy('timestamp', 'desc'),
          limit(100)
        );
        const allActivitiesSnapshot = await getDocs(activityQuery);

        // Filter activities from last 7 days in memory
        const recentActivities = allActivitiesSnapshot.docs.filter(doc => {
          const timestamp = doc.data().timestamp?.toDate() || new Date(doc.data().timestamp);
          return timestamp >= sevenDaysAgo;
        });

        // Create a snapshot-like object for compatibility
        const activitySnapshot = { docs: recentActivities };

        // Get last active timestamp from the fetched activities (no orderBy needed)
        let lastActive = new Date();
        if (activitySnapshot.docs.length > 0) {
          const timestamps = activitySnapshot.docs.map(doc =>
            doc.data().timestamp?.toDate() || new Date(doc.data().timestamp)
          );
          lastActive = new Date(Math.max(...timestamps));
        }

        // Process activity logs
        const activityByDay = {};
        const activeDays = new Set();
        const sessions = [];

        activitySnapshot.docs.forEach(doc => {
          const data = doc.data();
          const timestamp = data.timestamp?.toDate() || new Date(data.timestamp);
          const dayName = timestamp.toLocaleDateString('en-US', { weekday: 'short' });
          const dateKey = timestamp.toDateString();

          activeDays.add(dateKey);

          if (!activityByDay[dayName]) {
            activityByDay[dayName] = [];
          }
          activityByDay[dayName].push(timestamp);
        });

        // Calculate sessions (group activities within 30 minutes as one session)
        const allActivities = activitySnapshot.docs
          .map(doc => doc.data().timestamp?.toDate() || new Date(doc.data().timestamp))
          .sort((a, b) => a - b);

        let currentSession = [];
        allActivities.forEach(timestamp => {
          if (currentSession.length === 0) {
            currentSession.push(timestamp);
          } else {
            const lastTime = currentSession[currentSession.length - 1];
            const diffMinutes = (timestamp - lastTime) / (1000 * 60);
            if (diffMinutes <= 30) {
              currentSession.push(timestamp);
            } else {
              sessions.push(currentSession);
              currentSession = [timestamp];
            }
          }
        });
        if (currentSession.length > 0) {
          sessions.push(currentSession);
        }

        // Calculate average session duration
        const sessionDurations = sessions.map(session => {
          if (session.length < 2) return 5; // default 5 minutes for single activity
          const duration = (session[session.length - 1] - session[0]) / (1000 * 60);
          return duration;
        });
        const averageSessionDuration = sessionDurations.length > 0
          ? Math.round(sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length)
          : 0;

        // Build weekly trend (last 7 days)
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const today = new Date();
        const weeklyTrend = [];

        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(today.getDate() - i);
          const dayName = daysOfWeek[date.getDay()];
          const dateKey = date.toDateString();

          // Count activities for this day
          const dayActivities = activitySnapshot.docs.filter(doc => {
            const timestamp = doc.data().timestamp?.toDate() || new Date(doc.data().timestamp);
            return timestamp.toDateString() === dateKey;
          });

          // Estimate hours (assume each activity represents ~10 minutes of engagement)
          const hours = (dayActivities.length * 10) / 60;

          weeklyTrend.push({
            day: dayName,
            hours: Math.round(hours * 10) / 10
          });
        }

        // Fetch child mood logs
        const moodQuery = query(
          collection(db, 'studentMoods'),
          where('userId', '==', childId)
        );
        const moodSnapshot = await getDocs(moodQuery);
        
        // Filter last 7 days moods in memory
        const recentMoods = moodSnapshot.docs
          .map(doc => doc.data())
          .filter(doc => {
            const timestamp = doc.createdAt?.toDate?.() || new Date(doc.createdAt || doc.date);
            return timestamp >= sevenDaysAgo;
          });

        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

        const fourteenDaysMoods = moodSnapshot.docs
          .map(doc => doc.data())
          .filter(doc => {
            const timestamp = doc.createdAt?.toDate?.() || new Date(doc.createdAt || doc.date);
            return timestamp >= fourteenDaysAgo;
          });

        const dailySentiments = [];
        let positiveCount = 0;
        let negativeCount = 0;
        let neutralCount = 0;

        const moodEmojis = {
          happy: '😊',
          proud: '🥳',
          excited: '🤩',
          motivated: '💪',
          calm: '😌',
          focused: '🧠',
          neutral: '😐',
          anxious: '😰',
          stressed: '🥵',
          overwhelmed: '🤯',
          tired: '😴',
          sad: '😢',
          frustrated: '😤'
        };

        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(today.getDate() - i);
          const dayName = daysOfWeek[date.getDay()];
          const dateKey = date.toDateString();

          const dayMoodDoc = recentMoods.find(m => {
            const mDate = m.createdAt?.toDate?.() || new Date(m.createdAt || m.date);
            return mDate.toDateString() === dateKey;
          });

          let mood = null;
          let emoji = '—';

          if (dayMoodDoc) {
            mood = dayMoodDoc.emotion || 'neutral';
            emoji = moodEmojis[mood.toLowerCase()] || '😐';

            if (['happy', 'proud', 'excited', 'motivated', 'calm', 'focused'].includes(mood.toLowerCase())) {
              positiveCount++;
            } else if (['anxious', 'stressed', 'overwhelmed', 'sad', 'frustrated'].includes(mood.toLowerCase())) {
              negativeCount++;
            } else {
              neutralCount++;
            }
          }

          dailySentiments.push({
            day: dayName,
            mood,
            emoji
          });
        }

        let summaryLabel = 'No Data';
        let summaryDesc = 'No emotional check-ins logged this week.';
        let summaryEmoji = '❓';

        if (recentMoods.length > 0) {
          if (positiveCount > negativeCount && positiveCount > neutralCount) {
            summaryLabel = 'Mostly Positive & Motivated';
            summaryDesc = 'Your child is demonstrating high motivation and positive energy in studies.';
            summaryEmoji = '☀️';
          } else if (negativeCount > positiveCount && negativeCount > neutralCount) {
            summaryLabel = 'Experiencing Exam / Study Stress';
            summaryDesc = 'Check-ins indicate signs of fatigue or stress. A gentle encouraging chat might help.';
            summaryEmoji = '🌧️';
          } else {
            summaryLabel = 'Calm & Stable';
            summaryDesc = 'Your child has shown steady, focused engagement and neutral-to-positive moods.';
            summaryEmoji = '🌤️';
          }
        }

        setEngagement({
          activeDaysPerWeek: activeDays.size,
          sessionsPerWeek: sessions.length,
          averageSessionDuration,
          lastActive,
          weeklyTrend,
          dailySentiments,
          fourteenDaysMoods,
          sentimentSummary: {
            label: summaryLabel,
            desc: summaryDesc,
            emoji: summaryEmoji
          }
        });
      } catch (error) {
        if (!error.message?.includes('building')) {
          console.error('Error fetching engagement:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchEngagement();
  }, [childId]);

  if (loading) return <div style={styles.container}>Loading engagement data...</div>;
  if (!engagement) return <div style={styles.container}>No engagement data available</div>;

  // Calculate total weekly hours from actual session durations
  const totalWeeklyMinutes = engagement.sessionsPerWeek > 0
    ? engagement.sessionsPerWeek * engagement.averageSessionDuration
    : 0;
  const totalWeeklyHours = totalWeeklyMinutes / 60;

  return (
    <div style={styles.container}>
      <h3>🎯 Engagement Overview - {childName}</h3>

      <div style={styles.gridContainer}>
        <div 
          style={{ ...styles.card, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
          onMouseOver={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.45)';
            e.currentTarget.style.boxShadow = '0 6px 18px rgba(59, 130, 246, 0.1)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.25)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <h4>Active Days/Week</h4>
          <div style={styles.bigNumber}>{engagement.activeDaysPerWeek}</div>
          <span style={styles.label}>out of 7 days</span>
        </div>

        <div 
          style={{ ...styles.card, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
          onMouseOver={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.45)';
            e.currentTarget.style.boxShadow = '0 6px 18px rgba(59, 130, 246, 0.1)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.25)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <h4>Sessions/Week</h4>
          <div style={styles.bigNumber}>{engagement.sessionsPerWeek}</div>
          <span style={styles.label}>study sessions</span>
        </div>

        <div 
          style={{ ...styles.card, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
          onMouseOver={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.45)';
            e.currentTarget.style.boxShadow = '0 6px 18px rgba(59, 130, 246, 0.1)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.25)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <h4>Avg Session</h4>
          <div style={styles.bigNumber}>{engagement.averageSessionDuration}</div>
          <span style={styles.label}>minutes</span>
        </div>

        <div 
          style={{ ...styles.card, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}
          onMouseOver={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.45)';
            e.currentTarget.style.boxShadow = '0 6px 18px rgba(59, 130, 246, 0.1)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.25)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <h4>Total Weekly</h4>
          <div style={styles.bigNumber}>{totalWeeklyHours.toFixed(1)}</div>
          <span style={styles.label}>hours</span>
        </div>
      </div>

      <div style={styles.lastActiveContainer}>
        <h4>Last Active</h4>
        <p style={styles.lastActiveTime}>
          {engagement.lastActive.toLocaleTimeString()} today
        </p>
      </div>

      {engagement.dailySentiments && engagement.sentimentSummary && (
        <div style={styles.sentimentContainer}>
          <div style={styles.sentimentHeader}>
            <h4 style={styles.sentimentTitle}>🧠 ASTRA Wellbeing & Sentiment Trends</h4>
            <span style={styles.sentimentBadge}>Privacy Protected</span>
          </div>
          <div style={{ ...styles.sentimentContent, flexDirection: 'column', alignItems: 'stretch' }}>
            <div style={styles.sentimentSummaryBox}>
              <div style={styles.sentimentEmojiLarge}>{engagement.sentimentSummary.emoji}</div>
              <div>
                <div style={styles.sentimentStatusLabel}>{engagement.sentimentSummary.label}</div>
                <p style={styles.sentimentDescText}>{engagement.sentimentSummary.desc}</p>
              </div>
            </div>
            
            <div style={{ marginTop: '16px' }}>
              <WellbeingChart moodLogs={engagement.fourteenDaysMoods || []} />
            </div>

            {/* Parenting Copilot Insights */}
            <div style={{
              marginTop: '16px',
              padding: '16px',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
              borderRadius: '12px',
              border: `1px solid ${
                engagement.sentimentSummary.label.toLowerCase().includes('stress') ? 'rgba(239, 68, 68, 0.25)' :
                engagement.sentimentSummary.label.toLowerCase().includes('positive') ? 'rgba(52, 211, 153, 0.25)' :
                'rgba(59, 130, 246, 0.25)'
              }`,
              boxShadow: `0 4px 20px ${
                engagement.sentimentSummary.label.toLowerCase().includes('stress') ? 'rgba(239, 68, 68, 0.08)' :
                engagement.sentimentSummary.label.toLowerCase().includes('positive') ? 'rgba(52, 211, 153, 0.08)' :
                'rgba(59, 130, 246, 0.08)'
              }`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>💡</span>
                <strong style={{ fontSize: '13px', color: '#f1f5f9' }}>Parenting Copilot Insights</strong>
              </div>
              <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0, lineHeight: '1.5' }}>
                {engagement.sentimentSummary.label.toLowerCase().includes('stress') ? (
                  <>
                    Your child is showing signs of academic or exam stress. Try using this supportive check-in prompt:
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      borderLeft: '3px solid #ef4444',
                      borderRadius: '4px',
                      color: '#fca5a5',
                      fontStyle: 'italic',
                      fontSize: '11px',
                      lineHeight: '1.4'
                    }}>
                      "Hey, I notice you've been working hard on your TriSphere lessons recently. Remember that taking short breaks is just as important as studying. Shall we take a 10-minute walk or grab a quick snack?"
                    </div>
                  </>
                ) : engagement.sentimentSummary.label.toLowerCase().includes('positive') ? (
                  <>
                    Your child is in a highly motivated headspace! Try this positive reinforcement prompt to boost their confidence:
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(52, 211, 153, 0.08)',
                      borderLeft: '3px solid #34d399',
                      borderRadius: '4px',
                      color: '#a7f3d0',
                      fontStyle: 'italic',
                      fontSize: '11px',
                      lineHeight: '1.4'
                    }}>
                      "You've been super consistent on TriSphere this week. Tell me about one interesting thing you learned in your simulations!"
                    </div>
                  </>
                ) : (
                  <>
                    Your child is in a steady, focused headspace. Reinforce their consistent progress with this simple word:
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(59, 130, 246, 0.08)',
                      borderLeft: '3px solid #3b82f6',
                      borderRadius: '4px',
                      color: '#93c5fd',
                      fontStyle: 'italic',
                      fontSize: '11px',
                      lineHeight: '1.4'
                    }}>
                      "I love seeing your focus this week. Keep taking it one step at a time, you're building fantastic learning habits!"
                    </div>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <div style={styles.trendContainer}>
        <div style={styles.trendHeader}>
          <h4 style={styles.trendTitle}>📊 Weekly Activity Trend</h4>
          <span style={styles.trendSubtitle}>Hours spent per day</span>
        </div>
        <div style={styles.trendBars}>
          {engagement.weeklyTrend.map((day, index) => {
            const maxHours = Math.max(...engagement.weeklyTrend.map(d => d.hours), 1);
            const heightPercent = (day.hours / maxHours) * 100;
            const isToday = index === engagement.weeklyTrend.length - 1;
            return (
              <div key={day.day} style={styles.trendDay}>
                <div style={styles.hoursTop}>{day.hours}h</div>
                <div style={styles.trendBarWrapper}>
                  <div
                    style={{
                      ...styles.trendBar,
                      height: `${Math.max(heightPercent, 5)}%`,
                      background: isToday
                        ? 'linear-gradient(180deg, #34d399, #10b981)'
                        : 'linear-gradient(180deg, #60a5fa, #3b82f6)',
                      boxShadow: isToday
                        ? '0 0 20px rgba(52, 211, 153, 0.5)'
                        : '0 0 15px rgba(59, 130, 246, 0.4)',
                      animation: 'growUp 0.8s ease-out forwards',
                      animationDelay: `${index * 0.1}s`
                    }}
                  />
                </div>
                <span style={{
                  ...styles.dayLabel,
                  color: isToday ? '#34d399' : '#ffffff',
                  fontWeight: isToday ? '700' : '500'
                }}>{day.day}</span>
                {isToday && <span style={styles.todayBadge}>Today</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 58, 95, 0.85))',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    color: '#ffffff'
  },
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '15px',
    marginTop: '15px',
    marginBottom: '20px'
  },
  card: {
    padding: '20px',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))',
    borderRadius: '10px',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    textAlign: 'center',
    backdropFilter: 'blur(5px)'
  },
  bigNumber: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#60a5fa',
    margin: '10px 0'
  },
  label: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.6)'
  },
  lastActiveContainer: {
    padding: '15px',
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(30, 58, 95, 0.5))',
    borderRadius: '10px',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    marginBottom: '20px'
  },
  lastActiveTime: {
    margin: '10px 0 0 0',
    fontSize: '14px',
    fontWeight: '600',
    color: '#34d399'
  },
  trendContainer: {
    padding: '20px',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))',
    borderRadius: '16px',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
  },
  trendHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '10px'
  },
  trendTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffffff'
  },
  trendSubtitle: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.5)',
    fontStyle: 'italic'
  },
  trendBars: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: '8px',
    padding: '0 10px'
  },
  trendDay: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flex: 1,
    maxWidth: '80px'
  },
  hoursTop: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#60a5fa',
    marginBottom: '8px',
    textShadow: '0 0 10px rgba(96, 165, 250, 0.5)'
  },
  trendBarWrapper: {
    width: '100%',
    height: '120px',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: '10px',
    background: 'rgba(15, 23, 42, 0.4)',
    borderRadius: '8px',
    padding: '8px 0'
  },
  trendBar: {
    width: '70%',
    background: 'linear-gradient(180deg, #60a5fa, #3b82f6)',
    borderRadius: '6px 6px 4px 4px',
    minHeight: '8px',
    transition: 'all 0.3s ease',
    position: 'relative'
  },
  dayLabel: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  todayBadge: {
    fontSize: '9px',
    fontWeight: '700',
    color: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    padding: '2px 6px',
    borderRadius: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  hoursLabel: {
    fontSize: '11px',
    color: 'rgba(255, 255, 255, 0.6)'
  },
  sentimentContainer: {
    padding: '20px',
    background: 'linear-gradient(135deg, rgba(30, 58, 95, 0.6), rgba(15, 23, 42, 0.8))',
    borderRadius: '16px',
    border: '1px solid rgba(59, 130, 246, 0.25)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
    marginBottom: '20px'
  },
  sentimentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px'
  },
  sentimentTitle: {
    margin: 0,
    fontSize: '16px',
    fontWeight: '700',
    color: '#ffffff'
  },
  sentimentBadge: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#60a5fa',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    padding: '2px 8px',
    borderRadius: '8px',
    border: '1px solid rgba(59, 130, 246, 0.2)'
  },
  sentimentContent: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  sentimentSummaryBox: {
    flex: '1 1 250px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '14px',
    background: 'rgba(15, 23, 42, 0.4)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.05)'
  },
  sentimentEmojiLarge: {
    fontSize: '32px'
  },
  sentimentStatusLabel: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#f1f5f9'
  },
  sentimentDescText: {
    fontSize: '11px',
    color: '#94a3b8',
    margin: '4px 0 0 0',
    lineHeight: '1.4'
  },
  dailySentimentFlow: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'space-between',
    flex: '2 1 300px'
  },
  dailyMoodItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    flex: 1
  },
  dailyMoodDay: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#64748b'
  },
  dailyMoodDot: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    transition: 'all 0.2s ease',
    cursor: 'pointer'
  }
};
