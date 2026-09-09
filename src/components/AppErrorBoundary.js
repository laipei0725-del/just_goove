import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default class AppErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) {
    console.warn('JUST GROOVE isolated a rendering error.', error, info?.componentStack);
  }

  componentDidUpdate(previousProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <View style={styles.card}><Text style={styles.title}>這個內容暫時無法顯示</Text><Text style={styles.copy}>其他功能仍可正常使用，請重新載入此內容。</Text><Pressable style={styles.button} onPress={() => this.setState({ error: null })}><Text style={styles.buttonText}>重試</Text></Pressable></View>;
  }
}

const styles = StyleSheet.create({ card: { flex: 1, minHeight: 180, alignItems: 'center', justifyContent: 'center', backgroundColor: '#171717', borderRadius: 20, borderWidth: 1, borderColor: '#343434', padding: 24 }, title: { color: '#F4F4F2', fontSize: 17, fontWeight: '800' }, copy: { color: '#9A9A96', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 }, button: { backgroundColor: '#C8FF35', borderRadius: 13, paddingHorizontal: 20, paddingVertical: 11, marginTop: 18 }, buttonText: { color: '#0D0D0D', fontWeight: '800' } });
