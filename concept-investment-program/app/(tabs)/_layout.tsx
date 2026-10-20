

import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, getPalette } from '../../constants/app-theme';
import SupportChatBubble from '../../components/SupportChatBubble';
import React from 'react';
import { View } from 'react-native';

function InvestorTabs() {
  const { isDark } = useAppTheme();
  const palette = getPalette(isDark);

  const tabIcons: Record<
    string,
    {
      focused: React.ComponentProps<typeof Ionicons>['name'];
      unfocused: React.ComponentProps<typeof Ionicons>['name'];
    }
  > = {
    index: { focused: 'home', unfocused: 'home-outline' },
    investments: { focused: 'briefcase', unfocused: 'briefcase-outline' },
    roi: { focused: 'receipt', unfocused: 'receipt-outline' },
    profile: { focused: 'person', unfocused: 'person-outline' },
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: palette.blue,
          tabBarInactiveTintColor: palette.muted,
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginBottom: 4,
          },
          tabBarStyle: {
            height: 106,
            paddingTop: 8,
            paddingBottom: 7,
            backgroundColor: palette.white,
            borderTopColor: palette.border,
            borderTopWidth: 1,
            elevation: 0,
          },
          tabBarIcon: ({ focused, color, size }) => {
            const icons = tabIcons[route.name];
            return (
              <Ionicons
                name={
                  (focused ? icons?.focused : icons?.unfocused) ??
                  'ellipse-outline'
                }
                size={size}
                color={color}
              />
            );
          },
        })}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="investments" options={{ title: 'Investments' }} />
        <Tabs.Screen name="roi" options={{ title: 'ROI History' }} />
        <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="investment-details" options={{ href: null }} />
        <Tabs.Screen name="reinvest" options={{ href: null }} />
        <Tabs.Screen name="apply-investment" options={{ href: null }} />
        <Tabs.Screen name="support" options={{ href: null }} />
      </Tabs>

      <SupportChatBubble />
    </View>
  );
}

export default function TabLayout() {
  return <InvestorTabs />;
}


// import { Tabs } from 'expo-router';
// import { Ionicons } from '@expo/vector-icons';
// import { useAppTheme, getPalette } from '../../constants/app-theme';
// import React from 'react';

// function InvestorTabs() {
//   const { isDark } = useAppTheme();
//   const palette = getPalette(isDark);
//   const tabIcons: Record<string, { focused: React.ComponentProps<typeof Ionicons>['name']; unfocused: React.ComponentProps<typeof Ionicons>['name'] }> = {
//     index: { focused: 'home', unfocused: 'home-outline' },
//     investments: { focused: 'briefcase', unfocused: 'briefcase-outline' },
//     roi: { focused: 'receipt', unfocused: 'receipt-outline' },
//     profile: { focused: 'person', unfocused: 'person-outline' },
//   };
//   return <Tabs screenOptions={({ route }) => ({
//     headerShown: false,
//     tabBarActiveTintColor: palette.blue,
//     tabBarInactiveTintColor: palette.muted,
//     tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
//     tabBarStyle: { height: 106, paddingTop: 8, paddingBottom: 7, backgroundColor: palette.white, borderTopColor: palette.border, borderTopWidth: 1, elevation: 0 },
//     tabBarIcon: ({ focused, color, size }) => { const icons = tabIcons[route.name]; return <Ionicons name={(focused ? icons?.focused : icons?.unfocused) ?? 'ellipse-outline'} size={size} color={color} />; },
//   })}>
//     <Tabs.Screen name="index" options={{ title: 'Home' }} />
//     <Tabs.Screen name="investments" options={{ title: 'Investments' }} />
//     <Tabs.Screen name="roi" options={{ title: 'ROI History' }} />
//     <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
//     <Tabs.Screen name="notifications" options={{ href: null }} />
//     <Tabs.Screen name="investment-details" options={{ href: null }} />
//     <Tabs.Screen name="reinvest" options={{ href: null }} />
//     <Tabs.Screen name="apply-investment" options={{ href: null }} />
//     <Tabs.Screen name="support" options={{ href: null }} />
    
//   </Tabs>;
// }
// export default function TabLayout() { return <InvestorTabs />; }
