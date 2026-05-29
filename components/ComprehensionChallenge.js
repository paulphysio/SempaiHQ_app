import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '../services/supabaseClient';
import { EmbeddedWalletContext } from './ConnectButtonEnhanced';
import { styles } from '../styles/ComprehensionChallengeStyles';

const DIFFICULTY_COLORS = {
  easy: ['#4CAF50', '#45A049'],
  medium: ['#FF9800', '#F57C00'],
  hard: ['#F44336', '#D32F2F']
};

const DIFFICULTY_ICONS = {
  easy: 'leaf',
  medium: 'balance-scale',
  hard: 'fire'
};

const ComprehensionChallenge = ({ visible, novelId, chapterNumber, onComplete, onClose }) => {
  const { wallet } = useContext(EmbeddedWalletContext);
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [responseTime, setResponseTime] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      loadChallenge();
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, novelId, chapterNumber]);

  const loadChallenge = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('comprehension_challenges')
        .select('*')
        .eq('novel_id', novelId)
        .eq('chapter_number', chapterNumber)
        .limit(1)
        .single();

      if (error) throw error;
      setChallenge(data);
    } catch (error) {
      console.error('[ComprehensionChallenge] Error loading challenge:', error);
      // Generate a fallback challenge if none exists
      setChallenge({
        question: 'What was the main theme of this chapter?',
        options: ['Adventure', 'Romance', 'Mystery', 'Comedy'],
        correct_answer: 0,
        difficulty: 'medium'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (answerIndex) => {
    if (showResult) return;
    
    setSelectedAnswer(answerIndex);
    const timeTaken = Date.now() - startTime;
    setResponseTime(timeTaken);
    
    const correct = answerIndex === challenge.correct_answer;
    setIsCorrect(correct);
    setShowResult(true);

    // Record the attempt
    recordAttempt(answerIndex, correct, timeTaken);
  };

  const recordAttempt = async (answer, correct, time) => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', wallet?.publicKey)
        .single();

      if (userData) {
        // Get active reading session
        const { data: sessionData } = await supabase
          .from('reading_sessions')
          .select('id')
          .eq('user_id', userData.id)
          .eq('novel_id', novelId)
          .eq('chapter_number', chapterNumber)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (sessionData) {
          await supabase
            .from('challenge_attempts')
            .insert({
              session_id: sessionData.id,
              challenge_id: challenge?.id,
              user_answer: answer,
              is_correct: correct,
              response_time_ms: time
            });
        }
      }
    } catch (error) {
      console.error('[ComprehensionChallenge] Error recording attempt:', error);
    }
  };

  const handleNext = () => {
    if (onComplete) {
      onComplete(isCorrect, responseTime);
    }
    onClose();
  };

  const handleStart = () => {
    setStartTime(Date.now());
  };

  if (!visible) return null;

  const difficulty = challenge?.difficulty || 'medium';
  const colors = DIFFICULTY_COLORS[difficulty];
  const icon = DIFFICULTY_ICONS[difficulty];

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      <View style={styles.container}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <FontAwesome5 name="times" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <FontAwesome5 name={icon} size={40} color="#FFFFFF" />
          <Text style={styles.difficultyTitle}>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</Text>
          <Text style={styles.difficultySubtitle}>Comprehension Challenge</Text>
        </LinearGradient>

        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4A90E2" />
              <Text style={styles.loadingText}>Loading challenge...</Text>
            </View>
          ) : (
            <>
              <View style={styles.questionContainer}>
                <FontAwesome5 name="question-circle" size={24} color="#4A90E2" />
                <Text style={styles.questionText}>{challenge?.question || 'Loading question...'}</Text>
              </View>

              <View style={styles.optionsContainer}>
                {challenge?.options?.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.optionButton,
                      selectedAnswer === index && styles.selectedOption,
                      showResult && index === challenge.correct_answer && styles.correctOption,
                      showResult && selectedAnswer === index && !isCorrect && styles.wrongOption
                    ]}
                    onPress={() => handleAnswerSelect(index)}
                    disabled={showResult}
                    onPressIn={handleStart}
                  >
                    <View style={styles.optionIndicator}>
                      <Text style={[
                        styles.optionIndicatorText,
                        selectedAnswer === index && styles.selectedIndicatorText
                      ]}>
                        {String.fromCharCode(65 + index)}
                      </Text>
                    </View>
                    <Text style={[
                      styles.optionText,
                      selectedAnswer === index && styles.selectedOptionText
                    ]}>
                      {option}
                    </Text>
                    {showResult && index === challenge.correct_answer && (
                      <FontAwesome5 name="check" size={20} color="#4CAF50" style={styles.resultIcon} />
                    )}
                    {showResult && selectedAnswer === index && !isCorrect && (
                      <FontAwesome5 name="times" size={20} color="#F44336" style={styles.resultIcon} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {showResult && (
                <Animated.View style={styles.resultContainer}>
                  <LinearGradient
                    colors={isCorrect ? ['#4CAF50', '#45A049'] : ['#F44336', '#D32F2F']}
                    style={styles.resultBanner}
                  >
                    <FontAwesome5 
                      name={isCorrect ? 'check-circle' : 'times-circle'} 
                      size={30} 
                      color="#FFFFFF" 
                    />
                    <Text style={styles.resultText}>
                      {isCorrect ? 'Correct!' : 'Incorrect'}
                    </Text>
                    <Text style={styles.resultSubtext}>
                      Response time: {(responseTime / 1000).toFixed(1)}s
                    </Text>
                  </LinearGradient>
                  <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
                    <Text style={styles.nextButtonText}>Continue</Text>
                    <FontAwesome5 name="arrow-right" size={16} color="#FFFFFF" style={styles.nextButtonIcon} />
                  </TouchableOpacity>
                </Animated.View>
              )}
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

export default ComprehensionChallenge;
