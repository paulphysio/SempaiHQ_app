import React from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';

const LoadingButton = ({
  title,
  onPress,
  isLoading = false,
  disabled = false,
  style,
  textStyle,
  icon,
  iconPosition = 'left',
  gradientColors = ['#FF5733', '#F36316'],
  useGradient = true,
  loadingColor = '#FFFFFF',
  ...props
}) => {
  const isDisabled = disabled || isLoading;

  const handlePress = async () => {
    if (!isDisabled) {
      await onPress();
    }
  };

  const buttonContent = (
    <View style={styles.buttonContent}>
      {isLoading ? (
        <ActivityIndicator color={loadingColor} size="small" style={styles.loader} />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <FontAwesome5 name={icon} size={16} color="#FFFFFF" style={styles.iconLeft} />
          )}
          <Text style={[styles.buttonText, textStyle]}>{title}</Text>
          {icon && iconPosition === 'right' && (
            <FontAwesome5 name={icon} size={16} color="#FFFFFF" style={styles.iconRight} />
          )}
        </>
      )}
    </View>
  );

  if (useGradient) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={isDisabled}
        activeOpacity={0.7}
        style={[style, isDisabled && styles.disabled]}
        {...props}
      >
        <LinearGradient
          colors={isDisabled ? ['#999999', '#777777'] : gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradientButton, style]}
        >
          {buttonContent}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[styles.solidButton, style, isDisabled && styles.disabled]}
      {...props}
    >
      {buttonContent}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    
    fontFamily: 'AnimeAce',
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
  loader: {
    margin: 0,
  },
  gradientButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  solidButton: {
    backgroundColor: '#FF5733',
    borderRadius: 8,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default LoadingButton;
