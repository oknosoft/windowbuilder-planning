--
-- PostgreSQL database dump
--

-- Dumped from database version 14.7
-- Dumped by pg_dump version 14.7

-- Started on 2023-03-17 14:27:03 MSK

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = off;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET escape_string_warning = off;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 2899788)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 3360 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner:
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 214 (class 1259 OID 2900281)
-- Name: calc_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calc_orders (
    ref uuid NOT NULL,
    abonent uuid,
    branch uuid,
    year integer,
    date date,
    partner uuid,
    organization uuid,
    author uuid,
    department uuid
);


ALTER TABLE public.calc_orders OWNER TO postgres;

--
-- TOC entry 213 (class 1259 OID 2900139)
-- Name: characteristics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.characteristics (
    ref uuid NOT NULL,
    abonent uuid,
    branch uuid,
    calc_order uuid,
    year integer
);


ALTER TABLE public.characteristics OWNER TO postgres;

--
-- TOC entry 212 (class 1259 OID 2899806)
-- Name: keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.keys (
    ref uuid DEFAULT public.uuid_generate_v1mc() NOT NULL,
    obj uuid NOT NULL,
    specimen integer DEFAULT 1 NOT NULL,
    elm integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.keys OWNER TO postgres;

--
-- TOC entry 215 (class 1259 OID 2900714)
-- Name: settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.settings (
    param character varying(100) NOT NULL,
    value json NOT NULL
);


ALTER TABLE public.settings OWNER TO postgres;

--
-- TOC entry 3205 (class 1259 OID 2900590)
-- Name: address; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX address ON public.keys USING btree (obj, specimen, elm);


--
-- TOC entry 3209 (class 2606 OID 2900143)
-- Name: characteristics characteristics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.characteristics
    ADD CONSTRAINT characteristics_pkey PRIMARY KEY (ref);


--
-- TOC entry 3207 (class 2606 OID 2899811)
-- Name: keys keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keys
    ADD CONSTRAINT keys_pkey PRIMARY KEY (ref);


--
-- TOC entry 3211 (class 2606 OID 2900285)
-- Name: calc_orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calc_orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (ref);


--
-- TOC entry 3213 (class 2606 OID 2900720)
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (param);


--
-- TOC entry 3214 (class 2606 OID 2900422)
-- Name: keys cx; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keys
    ADD CONSTRAINT cx FOREIGN KEY (obj) REFERENCES public.characteristics(ref) NOT VALID;


--
-- TOC entry 3215 (class 2606 OID 2900448)
-- Name: characteristics order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.characteristics
    ADD CONSTRAINT "order" FOREIGN KEY (calc_order) REFERENCES public.calc_orders(ref) NOT VALID;


-- Completed on 2023-03-17 14:27:03 MSK

--
-- PostgreSQL database dump complete
--

