--
-- PostgreSQL database dump
--

-- Dumped from database version 14.7
-- Dumped by pg_dump version 14.7

-- Started on 2023-04-25 07:50:26 MSK

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
-- TOC entry 3374 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner:
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 862 (class 1247 OID 3176553)
-- Name: key_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.key_type AS ENUM (
    'order',
    'product',
    'layer',
    'profile',
    'filling',
    'glass',
    'layout',
    'other'
);


ALTER TYPE public.key_type OWNER TO postgres;

--
-- TOC entry 868 (class 1247 OID 3698031)
-- Name: prod_row; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.prod_row AS (
	characteristic uuid,
	quantity integer
);


ALTER TYPE public.prod_row OWNER TO postgres;

--
-- TOC entry 865 (class 1247 OID 3556323)
-- Name: qinfo_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.qinfo_type AS (
	abonent uuid,
	year integer,
	branch uuid,
	barcode bigint,
	ref uuid,
	calc_order uuid,
	characteristic uuid,
	presentation character varying(200),
	specimen integer,
	elm integer,
	region integer,
	type public.key_type,
	leading_product uuid
);


ALTER TYPE public.qinfo_type OWNER TO postgres;

--
-- TOC entry 239 (class 1255 OID 3558639)
-- Name: qinfo(character varying); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.qinfo(code character varying) RETURNS public.qinfo_type
    LANGUAGE plpgsql
    AS $$
declare
	tmp qinfo_type;
	keys_row keys%ROWTYPE;
	cx_row characteristics%ROWTYPE;
	order_row calc_orders%ROWTYPE;
	icode bigint;
	ucode uuid;
begin
  /* ищем запись в keys */
  if(char_length(code) = 13) then
	code = substring(code, 1, 12);
  end if;
  if char_length(code) = 12 then
    icode = code;
	SELECT * INTO keys_row FROM keys WHERE barcode=icode;
  elseif char_length(code) = 36 then
    ucode = code;
    SELECT * INTO keys_row FROM keys WHERE ref=ucode;
  end if;

  /* подклеиваем заказ и прочую инфу */
  if keys_row.type is null then
	RAISE NOTICE 'null';
  elseif keys_row.type = 'order' then
	SELECT * INTO order_row FROM calc_orders WHERE ref=keys_row.obj;
  else
	SELECT * INTO cx_row FROM characteristics WHERE ref=keys_row.obj;
	SELECT * INTO order_row FROM calc_orders WHERE ref=cx_row.calc_order;
  end if;
  tmp.abonent = order_row.abonent;
  tmp.year = order_row.year;
  tmp.branch = order_row.branch;
  tmp.calc_order = order_row.ref;

  tmp.characteristic = cx_row.ref;
  tmp.leading_product = cx_row.leading_product;

  tmp.barcode = keys_row.barcode;
  tmp.ref = keys_row.ref;
  tmp.specimen = keys_row.specimen;
  tmp.elm = keys_row.elm;
  tmp.region = keys_row.region;
  tmp.type = keys_row.type;

  if keys_row.type = 'order' then
  	tmp.presentation = format('%s от %s', order_row.number_doc, order_row.date);
  else
  	tmp.presentation = cx_row.name;
  end if;
  return tmp;
end
$$;


ALTER FUNCTION public.qinfo(code character varying) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 215 (class 1259 OID 3061481)
-- Name: calc_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.calc_orders (
    ref uuid NOT NULL,
    abonent uuid,
    branch uuid,
    year integer,
    date timestamp without time zone,
    number_doc character(11),
    partner uuid,
    organization uuid,
    author uuid,
    department uuid,
    production json
);


ALTER TABLE public.calc_orders OWNER TO postgres;

--
-- TOC entry 213 (class 1259 OID 2900139)
-- Name: characteristics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.characteristics (
    ref uuid NOT NULL,
    calc_order uuid,
    leading_product uuid,
    name character varying(200)
);


ALTER TABLE public.characteristics OWNER TO postgres;

--
-- TOC entry 212 (class 1259 OID 2899806)
-- Name: keys; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.keys (
    ref uuid DEFAULT public.uuid_generate_v1mc() NOT NULL,
    obj uuid NOT NULL,
    specimen integer DEFAULT 1,
    elm integer DEFAULT 0,
    region integer DEFAULT 0,
    barcode bigint DEFAULT 0,
    type public.key_type
);


ALTER TABLE public.keys OWNER TO postgres;

--
-- TOC entry 214 (class 1259 OID 2900714)
-- Name: settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.settings (
    param character varying(100) NOT NULL,
    value json NOT NULL
);


ALTER TABLE public.settings OWNER TO postgres;

--
-- TOC entry 3219 (class 1259 OID 3061357)
-- Name: address; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX address ON public.keys USING btree (obj, specimen, elm, region);


--
-- TOC entry 3224 (class 2606 OID 2900143)
-- Name: characteristics characteristics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.characteristics
    ADD CONSTRAINT characteristics_pkey PRIMARY KEY (ref);


--
-- TOC entry 3222 (class 2606 OID 2899811)
-- Name: keys keys_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.keys
    ADD CONSTRAINT keys_pkey PRIMARY KEY (ref);


--
-- TOC entry 3228 (class 2606 OID 3061485)
-- Name: calc_orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.calc_orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (ref);


--
-- TOC entry 3226 (class 2606 OID 2900720)
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (param);


--
-- TOC entry 3220 (class 1259 OID 3494689)
-- Name: barcode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX barcode ON public.keys USING btree (barcode);


--
-- TOC entry 3229 (class 2606 OID 3061494)
-- Name: characteristics order; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.characteristics
    ADD CONSTRAINT "order" FOREIGN KEY (calc_order) REFERENCES public.calc_orders(ref) NOT VALID;


-- Completed on 2023-04-25 07:50:26 MSK

--
-- PostgreSQL database dump complete
--

