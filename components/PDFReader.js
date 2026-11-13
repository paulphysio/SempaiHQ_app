import React, { useState, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import Pdf from 'react-native-pdf';
import { Ionicons } from '@expo/vector-icons';
import styles from '../styles/ReaderStyles';

const PDFReader = ({ file, onBack }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const pdfRef = useRef(null);

  const handleLoadComplete = (numberOfPages) => {
    setTotalPages(numberOfPages);
    setLoading(false);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePrevious = () => {
    if (currentPage > 1 && pdfRef.current) {
      pdfRef.current.setPage(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages && pdfRef.current) {
      pdfRef.current.setPage(currentPage + 1);
    }
  };

  return (
    <View style={styles.readerContainer}>
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF5733" />
          <Text style={styles.loadingText}>Loading PDF...</Text>
        </View>
      )}

      <View style={styles.fileInfo}>
        <Text style={styles.fileName} numberOfLines={1}>
          {file.name}
        </Text>
        <View style={styles.fileTypeBadge}>
          <Text style={styles.fileTypeText}>PDF</Text>
        </View>
      </View>

      <Pdf
        ref={pdfRef}
        source={{ uri: file.uri }}
        onLoadComplete={handleLoadComplete}
        onPageChanged={handlePageChange}
        style={styles.pdfContainer}
        enablePaging
        spacing={10}
        horizontal
        trustAllCerts={false}
      />

      {totalPages > 0 && (
        <>
          <View style={styles.pageIndicator}>
            <Text style={styles.pageIndicatorText}>
              Page {currentPage} of {totalPages}
            </Text>
          </View>

          <View style={styles.navigationControls}>
            <TouchableOpacity
              style={styles.navButton}
              onPress={handlePrevious}
              disabled={currentPage <= 1}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={currentPage <= 1 ? '#8A8A99' : '#FF5733'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.navButton}
              onPress={handleNext}
              disabled={currentPage >= totalPages}
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={currentPage >= totalPages ? '#8A8A99' : '#FF5733'}
              />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

export default PDFReader;
