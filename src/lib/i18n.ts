import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enCommon from '../locales/en/common.json';
import esCommon from '../locales/es/common.json';
import thCommon from '../locales/th/common.json';
import frCommon from '../locales/fr/common.json';
import itCommon from '../locales/it/common.json';
import deCommon from '../locales/de/common.json';
import jaCommon from '../locales/ja/common.json';

import enLanding from '../locales/en/landing.json';
import esLanding from '../locales/es/landing.json';
import thLanding from '../locales/th/landing.json';
import frLanding from '../locales/fr/landing.json';
import itLanding from '../locales/it/landing.json';
import deLanding from '../locales/de/landing.json';
import jaLanding from '../locales/ja/landing.json';

import enProfile from '../locales/en/profile.json';
import esProfile from '../locales/es/profile.json';
import thProfile from '../locales/th/profile.json';
import frProfile from '../locales/fr/profile.json';
import itProfile from '../locales/it/profile.json';
import deProfile from '../locales/de/profile.json';
import jaProfile from '../locales/ja/profile.json';

import enLocked from '../locales/en/locked.json';
import esLocked from '../locales/es/locked.json';
import thLocked from '../locales/th/locked.json';
import frLocked from '../locales/fr/locked.json';
import itLocked from '../locales/it/locked.json';
import deLocked from '../locales/de/locked.json';
import jaLocked from '../locales/ja/locked.json';

import enFeed from '../locales/en/feed.json';
import esFeed from '../locales/es/feed.json';
import thFeed from '../locales/th/feed.json';
import frFeed from '../locales/fr/feed.json';
import itFeed from '../locales/it/feed.json';
import deFeed from '../locales/de/feed.json';
import jaFeed from '../locales/ja/feed.json';

import enFeedPage from '../locales/en/feedPage.json';
import esFeedPage from '../locales/es/feedPage.json';
import thFeedPage from '../locales/th/feedPage.json';
import frFeedPage from '../locales/fr/feedPage.json';
import itFeedPage from '../locales/it/feedPage.json';
import deFeedPage from '../locales/de/feedPage.json';
import jaFeedPage from '../locales/ja/feedPage.json';

import enFeedTabs from '../locales/en/feedTabs.json';
import esFeedTabs from '../locales/es/feedTabs.json';
import thFeedTabs from '../locales/th/feedTabs.json';
import frFeedTabs from '../locales/fr/feedTabs.json';
import itFeedTabs from '../locales/it/feedTabs.json';
import deFeedTabs from '../locales/de/feedTabs.json';
import jaFeedTabs from '../locales/ja/feedTabs.json';

import enAddEntry from '../locales/en/addEntry.json';
import esAddEntry from '../locales/es/addEntry.json';
import thAddEntry from '../locales/th/addEntry.json';
import frAddEntry from '../locales/fr/addEntry.json';
import itAddEntry from '../locales/it/addEntry.json';
import deAddEntry from '../locales/de/addEntry.json';
import jaAddEntry from '../locales/ja/addEntry.json';

import enAuth from '../locales/en/auth.json';
import esAuth from '../locales/es/auth.json';
import thAuth from '../locales/th/auth.json';
import frAuth from '../locales/fr/auth.json';
import itAuth from '../locales/it/auth.json';
import deAuth from '../locales/de/auth.json';
import jaAuth from '../locales/ja/auth.json';

import enResetPassword from '../locales/en/resetPassword.json';
import esResetPassword from '../locales/es/resetPassword.json';
import thResetPassword from '../locales/th/resetPassword.json';
import frResetPassword from '../locales/fr/resetPassword.json';
import itResetPassword from '../locales/it/resetPassword.json';
import deResetPassword from '../locales/de/resetPassword.json';
import jaResetPassword from '../locales/ja/resetPassword.json';

import enFollowList from '../locales/en/followList.json';
import esFollowList from '../locales/es/followList.json';
import thFollowList from '../locales/th/followList.json';
import frFollowList from '../locales/fr/followList.json';
import itFollowList from '../locales/it/followList.json';
import deFollowList from '../locales/de/followList.json';
import jaFollowList from '../locales/ja/followList.json';

import enUserProfileModal from '../locales/en/userProfileModal.json';
import esUserProfileModal from '../locales/es/userProfileModal.json';
import thUserProfileModal from '../locales/th/userProfileModal.json';
import frUserProfileModal from '../locales/fr/userProfileModal.json';
import itUserProfileModal from '../locales/it/userProfileModal.json';
import deUserProfileModal from '../locales/de/userProfileModal.json';
import jaUserProfileModal from '../locales/ja/userProfileModal.json';

import enDashboard from '../locales/en/dashboard.json';
import esDashboard from '../locales/es/dashboard.json';
import thDashboard from '../locales/th/dashboard.json';
import frDashboard from '../locales/fr/dashboard.json';
import itDashboard from '../locales/it/dashboard.json';
import deDashboard from '../locales/de/dashboard.json';
import jaDashboard from '../locales/ja/dashboard.json';

import enGroupInvites from '../locales/en/groupInvites.json';
import esGroupInvites from '../locales/es/groupInvites.json';
import thGroupInvites from '../locales/th/groupInvites.json';
import frGroupInvites from '../locales/fr/groupInvites.json';
import itGroupInvites from '../locales/it/groupInvites.json';
import deGroupInvites from '../locales/de/groupInvites.json';
import jaGroupInvites from '../locales/ja/groupInvites.json';

import enSaved from '../locales/en/saved.json';
import esSaved from '../locales/es/saved.json';
import thSaved from '../locales/th/saved.json';
import frSaved from '../locales/fr/saved.json';
import itSaved from '../locales/it/saved.json';
import deSaved from '../locales/de/saved.json';
import jaSaved from '../locales/ja/saved.json';

import enNotifications from '../locales/en/notifications.json';
import esNotifications from '../locales/es/notifications.json';
import thNotifications from '../locales/th/notifications.json';
import frNotifications from '../locales/fr/notifications.json';
import itNotifications from '../locales/it/notifications.json';
import deNotifications from '../locales/de/notifications.json';
import jaNotifications from '../locales/ja/notifications.json';

import enLoginOverlay from '../locales/en/loginOverlay.json';
import esLoginOverlay from '../locales/es/loginOverlay.json';
import thLoginOverlay from '../locales/th/loginOverlay.json';
import frLoginOverlay from '../locales/fr/loginOverlay.json';
import itLoginOverlay from '../locales/it/loginOverlay.json';
import deLoginOverlay from '../locales/de/loginOverlay.json';
import jaLoginOverlay from '../locales/ja/loginOverlay.json';

import enGroups from '../locales/en/groups.json';
import esGroups from '../locales/es/groups.json';
import thGroups from '../locales/th/groups.json';
import frGroups from '../locales/fr/groups.json';
import itGroups from '../locales/it/groups.json';
import deGroups from '../locales/de/groups.json';
import jaGroups from '../locales/ja/groups.json';

import enGroupManage from '../locales/en/groupManage.json';
import esGroupManage from '../locales/es/groupManage.json';
import thGroupManage from '../locales/th/groupManage.json';
import frGroupManage from '../locales/fr/groupManage.json';
import itGroupManage from '../locales/it/groupManage.json';
import deGroupManage from '../locales/de/groupManage.json';
import jaGroupManage from '../locales/ja/groupManage.json';

import enCreateGroup from '../locales/en/createGroup.json';
import esCreateGroup from '../locales/es/createGroup.json';
import thCreateGroup from '../locales/th/createGroup.json';
import frCreateGroup from '../locales/fr/createGroup.json';
import itCreateGroup from '../locales/it/createGroup.json';
import deCreateGroup from '../locales/de/createGroup.json';
import jaCreateGroup from '../locales/ja/createGroup.json';

import enComments from '../locales/en/comments.json';
import esComments from '../locales/es/comments.json';
import thComments from '../locales/th/comments.json';
import frComments from '../locales/fr/comments.json';
import itComments from '../locales/it/comments.json';
import deComments from '../locales/de/comments.json';
import jaComments from '../locales/ja/comments.json';

import enRestaurantSearch from '../locales/en/restaurantSearch.json';
import esRestaurantSearch from '../locales/es/restaurantSearch.json';
import thRestaurantSearch from '../locales/th/restaurantSearch.json';
import frRestaurantSearch from '../locales/fr/restaurantSearch.json';
import itRestaurantSearch from '../locales/it/restaurantSearch.json';
import deRestaurantSearch from '../locales/de/restaurantSearch.json';
import jaRestaurantSearch from '../locales/ja/restaurantSearch.json';
import enMyTopBurgers from '../locales/en/myTopBurgers.json';
import esMyTopBurgers from '../locales/es/myTopBurgers.json';
import thMyTopBurgers from '../locales/th/myTopBurgers.json';
import frMyTopBurgers from '../locales/fr/myTopBurgers.json';
import itMyTopBurgers from '../locales/it/myTopBurgers.json';
import deMyTopBurgers from '../locales/de/myTopBurgers.json';
import jaMyTopBurgers from '../locales/ja/myTopBurgers.json';
import enBurgerWishlist from '../locales/en/burgerWishlist.json';
import esBurgerWishlist from '../locales/es/burgerWishlist.json';
import thBurgerWishlist from '../locales/th/burgerWishlist.json';
import frBurgerWishlist from '../locales/fr/burgerWishlist.json';
import itBurgerWishlist from '../locales/it/burgerWishlist.json';
import deBurgerWishlist from '../locales/de/burgerWishlist.json';
import jaBurgerWishlist from '../locales/ja/burgerWishlist.json';
import enFeatureAnnouncement from '../locales/en/featureAnnouncement.json';
import esFeatureAnnouncement from '../locales/es/featureAnnouncement.json';
import thFeatureAnnouncement from '../locales/th/featureAnnouncement.json';
import frFeatureAnnouncement from '../locales/fr/featureAnnouncement.json';
import itFeatureAnnouncement from '../locales/it/featureAnnouncement.json';
import deFeatureAnnouncement from '../locales/de/featureAnnouncement.json';
import jaFeatureAnnouncement from '../locales/ja/featureAnnouncement.json';

const resources = {
  en: {
    common: enCommon,
    landing: enLanding,
    profile: enProfile,
    locked: enLocked,
    feed: enFeed,
    feedPage: enFeedPage,
    feedTabs: enFeedTabs,
    addEntry: enAddEntry,
    auth: enAuth,
    resetPassword: enResetPassword,
    followList: enFollowList,
    userProfileModal: enUserProfileModal,
    dashboard: enDashboard,
    groupInvites: enGroupInvites,
    saved: enSaved,
    notifications: enNotifications,
    loginOverlay: enLoginOverlay,
    groups: enGroups,
    groupManage: enGroupManage,
    createGroup: enCreateGroup,
    comments: enComments,
    restaurantSearch: enRestaurantSearch,
    myTopBurgers: enMyTopBurgers,
    burgerWishlist: enBurgerWishlist,
    featureAnnouncement: enFeatureAnnouncement
  },
  es: {
    common: esCommon,
    landing: esLanding,
    profile: esProfile,
    locked: esLocked,
    feed: esFeed,
    feedPage: esFeedPage,
    feedTabs: esFeedTabs,
    addEntry: esAddEntry,
    auth: esAuth,
    resetPassword: esResetPassword,
    followList: esFollowList,
    userProfileModal: esUserProfileModal,
    dashboard: esDashboard,
    groupInvites: esGroupInvites,
    saved: esSaved,
    notifications: esNotifications,
    loginOverlay: esLoginOverlay,
    groups: esGroups,
    groupManage: esGroupManage,
    createGroup: esCreateGroup,
    comments: esComments,
    restaurantSearch: esRestaurantSearch,
    myTopBurgers: esMyTopBurgers,
    burgerWishlist: esBurgerWishlist,
    featureAnnouncement: esFeatureAnnouncement
  },
  th: {
    common: thCommon,
    landing: thLanding,
    profile: thProfile,
    locked: thLocked,
    feed: thFeed,
    feedPage: thFeedPage,
    feedTabs: thFeedTabs,
    addEntry: thAddEntry,
    auth: thAuth,
    resetPassword: thResetPassword,
    followList: thFollowList,
    userProfileModal: thUserProfileModal,
    dashboard: thDashboard,
    groupInvites: thGroupInvites,
    saved: thSaved,
    notifications: thNotifications,
    loginOverlay: thLoginOverlay,
    groups: thGroups,
    groupManage: thGroupManage,
    createGroup: thCreateGroup,
    comments: thComments,
    restaurantSearch: thRestaurantSearch,
    myTopBurgers: thMyTopBurgers,
    burgerWishlist: thBurgerWishlist,
    featureAnnouncement: thFeatureAnnouncement
  },
  fr: {
    common: frCommon,
    landing: frLanding,
    profile: frProfile,
    locked: frLocked,
    feed: frFeed,
    feedPage: frFeedPage,
    feedTabs: frFeedTabs,
    addEntry: frAddEntry,
    auth: frAuth,
    resetPassword: frResetPassword,
    followList: frFollowList,
    userProfileModal: frUserProfileModal,
    dashboard: frDashboard,
    groupInvites: frGroupInvites,
    saved: frSaved,
    notifications: frNotifications,
    loginOverlay: frLoginOverlay,
    groups: frGroups,
    groupManage: frGroupManage,
    createGroup: frCreateGroup,
    comments: frComments,
    restaurantSearch: frRestaurantSearch,
    myTopBurgers: frMyTopBurgers,
    burgerWishlist: frBurgerWishlist,
    featureAnnouncement: frFeatureAnnouncement
  },
  it: {
    common: itCommon,
    landing: itLanding,
    profile: itProfile,
    locked: itLocked,
    feed: itFeed,
    feedPage: itFeedPage,
    feedTabs: itFeedTabs,
    addEntry: itAddEntry,
    auth: itAuth,
    resetPassword: itResetPassword,
    followList: itFollowList,
    userProfileModal: itUserProfileModal,
    dashboard: itDashboard,
    groupInvites: itGroupInvites,
    saved: itSaved,
    notifications: itNotifications,
    loginOverlay: itLoginOverlay,
    groups: itGroups,
    groupManage: itGroupManage,
    createGroup: itCreateGroup,
    comments: itComments,
    restaurantSearch: itRestaurantSearch,
    myTopBurgers: itMyTopBurgers,
    burgerWishlist: itBurgerWishlist,
    featureAnnouncement: itFeatureAnnouncement
  },
  de: {
    common: deCommon,
    landing: deLanding,
    profile: deProfile,
    locked: deLocked,
    feed: deFeed,
    feedPage: deFeedPage,
    feedTabs: deFeedTabs,
    addEntry: deAddEntry,
    auth: deAuth,
    resetPassword: deResetPassword,
    followList: deFollowList,
    userProfileModal: deUserProfileModal,
    dashboard: deDashboard,
    groupInvites: deGroupInvites,
    saved: deSaved,
    notifications: deNotifications,
    loginOverlay: deLoginOverlay,
    groups: deGroups,
    groupManage: deGroupManage,
    createGroup: deCreateGroup,
    comments: deComments,
    restaurantSearch: deRestaurantSearch,
    myTopBurgers: deMyTopBurgers,
    burgerWishlist: deBurgerWishlist,
    featureAnnouncement: deFeatureAnnouncement
  },
  ja: {
    common: jaCommon,
    landing: jaLanding,
    profile: jaProfile,
    locked: jaLocked,
    feed: jaFeed,
    feedPage: jaFeedPage,
    feedTabs: jaFeedTabs,
    addEntry: jaAddEntry,
    auth: jaAuth,
    resetPassword: jaResetPassword,
    followList: jaFollowList,
    userProfileModal: jaUserProfileModal,
    dashboard: jaDashboard,
    groupInvites: jaGroupInvites,
    saved: jaSaved,
    notifications: jaNotifications,
    loginOverlay: jaLoginOverlay,
    groups: jaGroups,
    groupManage: jaGroupManage,
    createGroup: jaCreateGroup,
    comments: jaComments,
    restaurantSearch: jaRestaurantSearch,
    myTopBurgers: jaMyTopBurgers,
    burgerWishlist: jaBurgerWishlist,
    featureAnnouncement: jaFeatureAnnouncement
  }
};

const detectLanguage = () => {
  if (typeof window === 'undefined') return 'en';
  const stored = window.localStorage.getItem('bw-lang');
  if (stored) return stored;
  const navLang = window.navigator.language || window.navigator.languages?.[0];
  if (!navLang) return 'en';
  const code = navLang.slice(0, 2).toLowerCase();
  if (['en', 'es', 'th', 'fr', 'it', 'de', 'ja'].includes(code)) return code;
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: detectLanguage(),
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: [
      'common',
      'landing',
      'profile',
      'locked',
      'feed',
      'feedPage',
      'feedTabs',
      'addEntry',
      'auth',
      'resetPassword',
      'followList',
      'userProfileModal',
      'dashboard',
      'groupInvites',
      'saved',
      'notifications',
      'loginOverlay',
      'groups',
      'groupManage',
      'createGroup',
      'comments',
      'restaurantSearch',
      'myTopBurgers',
      'burgerWishlist',
      'featureAnnouncement'
    ],
    interpolation: { escapeValue: false },
    returnNull: false,
    react: {
      useSuspense: false
    },
    // Use dotted prefix as namespace separator (dashboard.title) and treat dots inside keys as literal.
    nsSeparator: '.',
    keySeparator: false
  });

export { i18n };
